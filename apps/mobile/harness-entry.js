// Thin wrapper entry point for React Native Harness.
// The harness resolver intercepts the require('./index.ts') call below
// and replaces it with the harness runtime entry point.
require('./index.ts');
