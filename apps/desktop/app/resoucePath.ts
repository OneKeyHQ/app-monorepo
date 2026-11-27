import fs from 'fs';
import * as path from 'path';

import { app } from 'electron';
import electronIsDev from 'electron-is-dev';

const isDev = !app?.isPackaged && electronIsDev;

const getJsBundleStaticPath = () => {
  const indexHtmlPath =
    globalThis.$desktopMainAppFunctions?.getBundleIndexHtmlPath?.();
  if (indexHtmlPath) {
    const dir = path.dirname(indexHtmlPath);
    const staticPath = path.join(dir, 'static');
    if (fs.existsSync(staticPath)) {
      return staticPath;
    }
  }
  return undefined;
};

export const getAppStaticResourcesPath = () => {
  return isDev
    ? path.join(__dirname, '../../public/static')
    : process.resourcesPath;
};

export const getAppStaticPath = () => {
  return !app?.isPackaged
    ? path.join(__dirname, '../../public/static')
    : path.join(process.resourcesPath, 'static');
};

export const getResourcesPath = () => {
  const staticPath = getJsBundleStaticPath();
  if (staticPath) {
    const dir = path.dirname(staticPath);
    return dir;
  }
  return getAppStaticResourcesPath();
};

export const getStaticPath = () => {
  const resourcesPath = getResourcesPath();
  return isDev
    ? path.join(__dirname, '../../public/static')
    : path.join(resourcesPath, 'static');
};
