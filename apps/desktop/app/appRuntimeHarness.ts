import fs from 'node:fs';
import path from 'node:path';
import {
  clearTimeout as nodeClearTimeout,
  setImmediate as nodeSetImmediate,
  setTimeout as nodeSetTimeout,
} from 'node:timers';

import {
  auditCanonicalNodeGlobals,
  auditNodeRuntime,
  captureNodeRuntimeBaseline,
  repairProtectedNodeRuntime,
} from './libs/nodeRuntimeIntegrity';

interface IHarnessStagingResult {
  afterExists: boolean;
  beforeExists: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  fileByteLength: number | null;
  fileUuidFormat: boolean | null;
  idLength: number | null;
  success: boolean;
}

class RuntimeHarnessError extends Error {}

const summarizeNames = (items: Array<{ name: string }>): string =>
  items.map(({ name }) => name).join(',');

const rendererReadyTimeoutMs = 30_000;
const updateCheckFallbackDelayMs = 15_000;
const rendererInitializationAllowanceMs = 15_000;

const waitForTimeout = (timeoutMs: number): Promise<void> =>
  new Promise((resolve) => {
    nodeSetTimeout(resolve, timeoutMs);
  });

const waitForRendererReady = async (
  rendererReadyPromise: Promise<void>,
): Promise<void> => {
  let timeout: ReturnType<typeof nodeSetTimeout> | undefined;
  try {
    await Promise.race([
      rendererReadyPromise,
      new Promise<never>((_resolve, reject) => {
        timeout = nodeSetTimeout(() => {
          reject(
            new Error(
              `Renderer did not reach dom-ready within ${rendererReadyTimeoutMs}ms`,
            ),
          );
        }, rendererReadyTimeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      nodeClearTimeout(timeout);
    }
  }
};

export async function runAppRuntimeHarness(outputFile: string): Promise<void> {
  const baseline = captureNodeRuntimeBaseline();
  const canonicalDriftsBeforeAppLoad = auditCanonicalNodeGlobals();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  const isolatedUserDataDir = process.env.DESKTOP_E2E_USER_DATA_DIR;
  if (!isolatedUserDataDir) {
    throw new RuntimeHarnessError(
      'DESKTOP_E2E_USER_DATA_DIR is required by the harness',
    );
  }
  // app.ts imports the persistent store before its executable statements run.
  // Establish the isolated path here so those module constructors cannot read
  // the host profile (including its boot-failure counter) during evaluation.
  app.setPath('userData', isolatedUserDataDir);

  let resolveRendererReady: (() => void) | undefined;
  const rendererReadyPromise = new Promise<void>((resolve) => {
    resolveRendererReady = resolve;
  });
  const onWebContentsCreated = (
    _event: Electron.Event,
    webContents: Electron.WebContents,
  ): void => {
    webContents.once('dom-ready', () => {
      resolveRendererReady?.();
      resolveRendererReady = undefined;
    });
  };
  app.on('web-contents-created', onWebContentsCreated);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { autoUpdater } =
    require('electron-updater') as typeof import('electron-updater');
  let checkForUpdatesCallCount = 0;
  autoUpdater.checkForUpdates = () => {
    checkForUpdatesCallCount += 1;
    return Promise.resolve(null);
  };
  autoUpdater.logger = null;
  autoUpdater.autoDownload = false;

  // The full application graph loads only after the pristine runtime snapshot.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./app');

  const driftsBeforeRepair = auditNodeRuntime(baseline);
  const repairs = repairProtectedNodeRuntime(baseline);
  const driftsAfterRepair = auditNodeRuntime(baseline);
  const canonicalDriftsAfterRepair = auditCanonicalNodeGlobals();

  if (driftsBeforeRepair.length > 0) {
    process.stderr.write(
      `[NODE_RUNTIME_INTEGRITY] detected=${summarizeNames(
        driftsBeforeRepair,
      )} repaired=${summarizeNames(repairs)} unresolved=${summarizeNames(
        driftsAfterRepair,
      )}\n`,
    );
  }

  await app.whenReady();
  await waitForRendererReady(rendererReadyPromise);
  // AppUpdateForeground can mount after dom-ready and then schedules its
  // cold-start check through runAfterTokensDone(), whose fallback is another
  // 15 seconds. Allow both phases so the harness cannot report success before
  // a delayed startup update check or late runtime mutation occurs.
  await waitForTimeout(
    rendererInitializationAllowanceMs + updateCheckFallbackDelayMs,
  );
  await new Promise<void>((resolve) => nodeSetImmediate(resolve));
  app.removeListener('web-contents-created', onWebContentsCreated);
  const driftsAfterAppInit = auditNodeRuntime(baseline);
  const canonicalDriftsAfterAppInit = auditCanonicalNodeGlobals();
  const stagingIdUpdater = autoUpdater as unknown as {
    getOrCreateStagingUserId: () => Promise<string>;
  };
  const updaterIdFile = path.join(app.getPath('userData'), '.updaterId');
  const beforeExists = fs.existsSync(updaterIdFile);
  let stagingResult: IHarnessStagingResult;

  try {
    const id = await stagingIdUpdater.getOrCreateStagingUserId();
    const afterExists = fs.existsSync(updaterIdFile);
    const fileContent = afterExists
      ? fs.readFileSync(updaterIdFile, 'utf8')
      : null;
    stagingResult = {
      afterExists,
      beforeExists,
      errorCode: null,
      errorMessage: null,
      fileByteLength: afterExists ? fs.statSync(updaterIdFile).size : null,
      fileUuidFormat:
        fileContent === null
          ? null
          : /^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/.test(
              fileContent,
            ),
      idLength: id.length,
      success: true,
    };
  } catch (error) {
    const typedError = error as Error & { code?: string };
    stagingResult = {
      afterExists: fs.existsSync(updaterIdFile),
      beforeExists,
      errorCode: typedError.code ?? null,
      errorMessage: typedError.message,
      fileByteLength: null,
      fileUuidFormat: null,
      idLength: null,
      success: false,
    };
  }

  const report = {
    arch: process.arch,
    autoDownload: autoUpdater.autoDownload,
    canonicalDriftsAfterAppInit,
    canonicalDriftsAfterRepair,
    canonicalDriftsBeforeAppLoad,
    checkForUpdatesCallCount,
    checkForUpdatesCalled: checkForUpdatesCallCount > 0,
    driftsAfterAppInit,
    driftsAfterRepair,
    driftsBeforeRepair,
    electron: process.versions.electron,
    isPackaged: app.isPackaged,
    node: process.versions.node,
    platform: process.platform,
    processType: process.type,
    repairs,
    stagingResult,
  };

  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2), 'utf8');
  const failed =
    canonicalDriftsBeforeAppLoad.length > 0 ||
    canonicalDriftsAfterRepair.length > 0 ||
    canonicalDriftsAfterAppInit.length > 0 ||
    driftsBeforeRepair.length > 0 ||
    repairs.length > 0 ||
    driftsAfterRepair.length > 0 ||
    driftsAfterAppInit.length > 0 ||
    !stagingResult.success ||
    !stagingResult.fileUuidFormat ||
    checkForUpdatesCallCount > 0 ||
    autoUpdater.autoDownload;
  app.exit(failed ? 2 : 0);
}
