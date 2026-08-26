import { describe, it, expect, vi, afterEach } from "vitest";
import worker from "../src/worker";
import type { Env } from "../src/router";
import { tryConsume } from "../src/trial/quotaLogic";

const ORIGIN = "https://qte77.github.io";
const OR_KEY = "or-secret-key";
const TS_SECRET = "turnstile-secret";

function trialReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://proxy.example/agent/trial-render", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBatch = [
  { beginRendering: { surfaceId: "main", root: "root" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [
        { id: "root", component: { Card: { child: "t" } } },
        { id: "t", component: { Text: { text: { literalString: "hi" }, usageHint: "body" } } },
      ],
    },
  },
];

const modelOk = () =>
  new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            tool_calls: [
              { function: { name: "render_ui", arguments: JSON.stringify({ messages: validBatch }) } },
            ],
          },
        },
      ],
    }),
    { status: 200 },
  );

function stubFetch(opts: { turnstile: boolean; model?: () => Response }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("siteverify")) {
        return Promise.resolve(new Response(JSON.stringify({ success: opts.turnstile }), { status: 200 }));
      }
      return Promise.resolve((opts.model ?? modelOk)());
    }),
  );
}

// A minimal fake DurableObjectNamespace: getByName(name) returns a per-name stub whose
// tryConsume/refund are backed by the SAME tested pure quotaLogic.tryConsume — so these tests
// exercise real cap-enforcement semantics without needing the real Workers runtime. `counts` is
// returned separately (not bolted onto the namespace) so assertions stay properly typed.
function fakeTrialDo(): { namespace: NonNullable<Env["TRIAL_DO"]>; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  const namespace = {
    getByName(name: string) {
      return {
        tryConsume(cap: number) {
          const current = counts.get(name) ?? 0;
          const decision = tryConsume(current, cap);
          if (decision.allowed) counts.set(name, decision.next);
          return Promise.resolve({ allowed: decision.allowed, remaining: decision.remaining });
        },
        refund() {
          counts.set(name, Math.max(0, (counts.get(name) ?? 0) - 1));
          return Promise.resolve();
        },
      };
    },
  } as unknown as NonNullable<Env["TRIAL_DO"]>;
  return { namespace, counts };
}

function baseEnv(trialDo = fakeTrialDo().namespace): Env {
  return { OPENROUTER_KEY: OR_KEY, TURNSTILE_SECRET: TS_SECRET, TRIAL_DO: trialDo };
}

describe("trial /agent/trial-render", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("503s when the trial tier has no DO binding configured", async () => {
    const res = await worker.fetch(
      trialReq({ messages: [], turnstileToken: "tok" }),
      { OPENROUTER_KEY: OR_KEY, TURNSTILE_SECRET: TS_SECRET },
    );
    expect(res.status).toBe(503);
  });

  it("renders a batch and reports remaining uses on success", async () => {
    stubFetch({ turnstile: true });
    const res = await worker.fetch(
      trialReq({ messages: [{ role: "user", content: "make a card" }], turnstileToken: "tok" }),
      baseEnv(),
    );
    expect(res.status).toBe(200);
    const body: { a2uiMessages?: unknown[]; remaining?: number } = await res.json();
    expect(Array.isArray(body.a2uiMessages)).toBe(true);
    expect(body.remaining).toBe(2); // cap 3, first use → 2 left
  });

  it("rejects an invalid turnstile token with 403 before touching either quota", async () => {
    const { namespace, counts } = fakeTrialDo();
    stubFetch({ turnstile: false });
    const res = await worker.fetch(trialReq({ messages: [], turnstileToken: "bad" }), baseEnv(namespace));
    expect(res.status).toBe(403);
    expect(counts.size).toBe(0); // no quota consumed on a failed Turnstile check
  });

  it("hard-caps a visitor at 3 uses, then 403s with remaining: 0", async () => {
    stubFetch({ turnstile: true });
    const env = baseEnv();
    const req = () =>
      trialReq(
        { messages: [{ role: "user", content: "x" }], turnstileToken: "tok" },
        { "cf-connecting-ip": "1.2.3.4" },
      );
    for (let i = 0; i < 3; i++) {
      const res = await worker.fetch(req(), env);
      expect(res.status).toBe(200);
    }
    const fourth = await worker.fetch(req(), env);
    expect(fourth.status).toBe(403);
    const body: { remaining?: number } = await fourth.json();
    expect(body.remaining).toBe(0);
  });

  it("does not consume a visitor's use when the model call fails (refunded)", async () => {
    stubFetch({ turnstile: true, model: () => new Response("upstream boom", { status: 500 }) });
    const env = baseEnv();
    const req = () =>
      trialReq(
        { messages: [{ role: "user", content: "x" }], turnstileToken: "tok" },
        { "cf-connecting-ip": "5.6.7.8" },
      );
    const first = await worker.fetch(req(), env);
    expect(first.status).toBe(502);
    const second = await worker.fetch(req(), env);
    expect(second.status).toBe(502); // still allowed — the failed first attempt was refunded
  });

  it("429s once the shared daily cap is exhausted, independent of per-visitor state", async () => {
    stubFetch({ turnstile: true });
    const env = baseEnv();
    env.TRIAL_DAILY_CAP = "1";
    const res1 = await worker.fetch(
      trialReq(
        { messages: [{ role: "user", content: "x" }], turnstileToken: "tok" },
        { "cf-connecting-ip": "9.9.9.9" },
      ),
      env,
    );
    expect(res1.status).toBe(200);
    const res2 = await worker.fetch(
      trialReq(
        { messages: [{ role: "user", content: "x" }], turnstileToken: "tok" },
        { "cf-connecting-ip": "1.1.1.1" }, // different visitor — daily cap is shared, not per-IP
      ),
      env,
    );
    expect(res2.status).toBe(429);
  });

  it("never echoes the OpenRouter key or Turnstile secret in the response", async () => {
    stubFetch({ turnstile: true });
    const res = await worker.fetch(
      trialReq({ messages: [{ role: "user", content: "x" }], turnstileToken: "tok" }),
      baseEnv(),
    );
    const text = await res.text();
    expect(text).not.toContain(OR_KEY);
    expect(text).not.toContain(TS_SECRET);
  });
});
