// Reset process.exitCode between tests so command tests that assert non-zero
// exit codes do not leak into Node's final exit code.
afterEach(() => {
  process.exitCode = 0;
});
