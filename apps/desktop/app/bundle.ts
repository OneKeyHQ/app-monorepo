import fs from 'fs';
import path from 'path';

import { app } from 'electron';
import logger from 'electron-log/main';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import * as store from './libs/store';

export const getBundleDirName = () => {
  const tempDir = path.join(app.getPath('userData'), 'onekey-bundle');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  logger.info('bundle-download-getBundleDirName', tempDir);
  return tempDir;
};

export const getBundleExtractDir = ({
  bundleDir,
  appVersion,
  bundleVersion,
}: {
  bundleDir: string;
  appVersion: string;
  bundleVersion: string;
}) => {
  return path.join(bundleDir, `${appVersion}-${bundleVersion}`);
};

export const getBundleIndexHtmlPath = () => {
  const bundleDir = getBundleDirName();
  const bundleData = store.getUpdateBundleData();
  if (platformEnv.version !== bundleData.appVersion) {
    return undefined;
  }
  const extractDir = getBundleExtractDir({
    bundleDir,
    appVersion: platformEnv.version || '1.0.0',
    bundleVersion: bundleData.bundleVersion || '1',
  });
  if (!fs.existsSync(extractDir)) {
    return undefined;
  }
  const indexHtmlPath = path.join(extractDir, 'web', 'index.html');
  logger.info('bundle-download-getBundleIndexHtmlPath', indexHtmlPath);
  return fs.existsSync(indexHtmlPath) ? indexHtmlPath : undefined;
};
