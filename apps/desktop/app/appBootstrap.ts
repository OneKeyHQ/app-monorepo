import fs from 'node:fs';
import path from 'node:path';

import {
  auditCanonicalNodeGlobals,
  auditNodeRuntime,
  captureNodeRuntimeBaseline,
  repairProtectedNodeRuntime,
} from './libs/nodeRuntimeIntegrity';

const baseline = captureNodeRuntimeBaseline();
const canonicalDriftsBeforeAppLoad = auditCanonicalNodeGlobals();

// The main application must load only after the pristine Electron/Node runtime
// has been captured. This catches module-evaluation side effects from imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('./app');

const driftsBeforeRepair = auditNodeRuntime(baseline);
const repairs = repairProtectedNodeRuntime(baseline);
const driftsAfterRepair = auditNodeRuntime(baseline);
const canonicalDriftsAfterRepair = auditCanonicalNodeGlobals();

const summarizeNames = (items: Array<{ name: string }>): string =>
  items.map(({ name }) => name).join(',');

if (driftsBeforeRepair.length > 0) {
  process.stderr.write(
    `[NODE_RUNTIME_INTEGRITY] detected=${summarizeNames(
      driftsBeforeRepair,
    )} repaired=${summarizeNames(repairs)} unresolved=${summarizeNames(
      driftsAfterRepair,
    )}\n`,
  );
}

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

async function runHarness(outputFile: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { autoUpdater } =
    require('electron-updater') as typeof import('electron-updater');

  autoUpdater.logger = null;
  autoUpdater.autoDownload = false;
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
    autoDownload: autoUpdater.autoDownload,
    canonicalDriftsAfterRepair,
    canonicalDriftsBeforeAppLoad,
    checkForUpdatesCalled: false,
    driftsAfterRepair,
    driftsBeforeRepair,
    electron: process.versions.electron,
    node: process.versions.node,
    processType: process.type,
    repairs,
    stagingResult,
  };

  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2), 'utf8');
  const failed =
    canonicalDriftsBeforeAppLoad.length > 0 ||
    canonicalDriftsAfterRepair.length > 0 ||
    driftsAfterRepair.length > 0 ||
    !stagingResult.success ||
    !stagingResult.fileUuidFormat ||
    autoUpdater.autoDownload;
  app.exit(failed ? 2 : 0);
}

const harnessOutputFile =
  process.env.ONEKEY_NODE_RUNTIME_INTEGRITY_HARNESS_OUTPUT;
if (harnessOutputFile) {
  void runHarness(harnessOutputFile).catch((error: unknown) => {
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
}
