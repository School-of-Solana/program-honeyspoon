import '@testing-library/jest-dom';
import { expect } from 'vitest';

type ExtendedMatchers<R = unknown> = import('@testing-library/jest-dom/matchers').TestingLibraryMatchers<
  ReturnType<typeof expect.stringContaining>,
  R
>;

declare module 'vitest' {
  interface Assertion<T = any> extends ExtendedMatchers<T> {}
  interface AsymmetricMatchersContaining extends ExtendedMatchers {}
}
