// Runtime shims the rspack web chain provides via ProvidePlugin
// (Buffer + process). Vite doesn't inject these, and several transitive deps in
// `@onekeyhq/shared` read `Buffer` / `process` as free globals at module-eval
// time, so they must exist before any component module is imported. This file
// is the FIRST import of `./injectTamaguiCss` (itself the first import in
// preview.tsx) for that reason.
import { Buffer } from 'buffer';

import process from 'process/browser';

const g = globalThis as unknown as {
  Buffer?: typeof Buffer;
  process?: typeof process;
  global?: typeof globalThis;
};

if (!g.Buffer) {
  g.Buffer = Buffer;
}
if (!g.process) {
  g.process = process;
}
// Some RN-web era deps still reference the Node `global` identifier.
if (!g.global) {
  g.global = globalThis;
}
