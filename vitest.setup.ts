import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import * as axeMatchers from "vitest-axe/matchers";
import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

expect.extend(axeMatchers);

// Vitest doesn't expose Jest-style implicit globals (test.globals is off),
// so @testing-library/react's auto-cleanup doesn't self-register — without
// this, DOM from one component test leaks into the next.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement the Blob-URL APIs; components that preview
// uploaded images call these, so stub them for tests.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock-url";
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}
