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
  // Strip ELECTRON_IS_DEV in packaged builds before loading the app graph so
  // bundled `electron-is-dev` cannot be forced true via environment variables.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  if (app?.isPackaged) {
    delete process.env.ELECTRON_IS_DEV;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./app');
}
