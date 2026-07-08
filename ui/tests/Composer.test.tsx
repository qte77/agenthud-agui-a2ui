import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Composer } from "../src/Composer";

// The free-text follow-up input (#195). Behavior: submit trimmed non-empty text, clear the field,
// and stay inert while disabled (streaming / before the first run).
describe("Composer", () => {
  const field = () => screen.getByPlaceholderText(/message the agent/i);
  const submit = () => fireEvent.submit(screen.getByRole("textbox").closest("form")!);

  it("submits trimmed text once and clears the field", () => {
    const onSend = vi.fn();
    render(<Composer disabled={false} onSend={onSend} />);

    fireEvent.change(field(), { target: { value: "  and then?  " } });
    submit();

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("and then?");
    expect(field()).toHaveValue("");
  });

  it("does nothing when disabled", () => {
    const onSend = vi.fn();
    render(<Composer disabled onSend={onSend} />);

    expect(field()).toBeDisabled();
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.change(field(), { target: { value: "hi" } });
    submit();

    expect(onSend).not.toHaveBeenCalled();
  });

  it("ignores a whitespace-only submission", () => {
    const onSend = vi.fn();
    render(<Composer disabled={false} onSend={onSend} />);

    fireEvent.change(field(), { target: { value: "    " } });
    submit();

    expect(onSend).not.toHaveBeenCalled();
  });
});
