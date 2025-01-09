import * as path from 'path';

import isDev from 'electron-is-dev';

export const resourcesPath = isDev
  ? path.join(__dirname, '../public/static')
  : process.resourcesPath;

export const staticPath = isDev
  ? path.join(__dirname, '../public/static')
  : path.join(resourcesPath, 'static');
