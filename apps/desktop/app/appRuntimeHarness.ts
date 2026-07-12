import fs from 'node:fs';
import path from 'node:path';
import { setImmediate as nodeSetImmediate } from 'node:timers';

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

const summarizeNames = (items: Array<{ name: string }>): string =>
  items.map(({ name }) => name).join(',');

export async function runAppRuntimeHarness(outputFile: string): Promise<void> {
  const baseline = captureNodeRuntimeBaseline();
  const canonicalDriftsBeforeAppLoad = auditCanonicalNodeGlobals();
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

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');

  await app.whenReady();
  await new Promise<void>((resolve) => {
    nodeSetImmediate(resolve);
  });
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
