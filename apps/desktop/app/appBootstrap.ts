const harnessOutputFile =
  process.env.ONEKEY_NODE_RUNTIME_INTEGRITY_HARNESS_OUTPUT;

if (harnessOutputFile) {
  // The diagnostic module must load before the application so it can capture
  // pristine Electron/Node references before any app dependency is evaluated.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runAppRuntimeHarness } =
    require('./appRuntimeHarness') as typeof import('./appRuntimeHarness');

  void runAppRuntimeHarness(harnessOutputFile).catch((error: unknown) => {
    // These modules stay lazy so the normal production path pays only for the
    // environment check above before loading the original application entry.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    const message = error instanceof Error ? error.message : String(error);
    fs.writeFileSync(
      harnessOutputFile,
      JSON.stringify({ fatalError: message }, null, 2),
      'utf8',
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron');
    app.exit(3);
  });
} else {
  // Capture native crashes before app dependencies or renderer startup.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { startNativeCrashCapture } =
    require('./libs/nativeCrashCapture') as typeof import('./libs/nativeCrashCapture');
  startNativeCrashCapture();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { startNativeCrashCollection } =
    require('./libs/nativeCrash') as typeof import('./libs/nativeCrash');
  startNativeCrashCollection();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./app');
}
