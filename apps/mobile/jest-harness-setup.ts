// Compatibility shim that bridges Jest globals to react-native-harness equivalents.
// This runs on the Hermes device (via setupFilesAfterEnv) before each test file,
// allowing existing *.test.ts files to work unchanged in the harness environment.
//
// Split into focused modules for maintainability:
// - harness/polyfills.ts    — Node.js globals, TextDecoder, structuredClone, IndexedDB, ES2023
// - harness/jest-compat.ts  — describe/test/it wrappers, module mock mechanism, jest shim
// - harness/snapshots.ts    — toMatchSnapshot / toMatchInlineSnapshot matchers

import './harness/polyfills';
// eslint-disable-next-line import/order
import './harness/jest-compat';
import './harness/snapshots';
