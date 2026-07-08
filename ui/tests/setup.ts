import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom doesn't implement scrollIntoView (used by Transcript's follow-scroll). Stub it globally so
// components can call it without guarding production code for a test-only environment gap.
Element.prototype.scrollIntoView = vi.fn();
