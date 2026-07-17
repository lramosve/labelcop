// vitest-axe ships its type augmentation against the older `Vi.Assertion`
// global namespace, which this Vitest version's explicitly-imported `expect`
// (import { expect } from "vitest") doesn't merge with. Re-declare against
// the `vitest` module directly, matching the pattern @testing-library/jest-dom
// uses for the same version of Vitest (see its types/vitest.d.ts).
import "vitest";
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
