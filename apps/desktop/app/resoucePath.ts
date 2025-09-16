import * as path from 'path';

import isDev from 'electron-is-dev';

export const getResourcesPath = () =>
  isDev ? path.join(__dirname, '../../public/static') : process.resourcesPath;

export const getStaticPath = () => {
  const resourcesPath = getResourcesPath();
  return isDev
    ? path.join(__dirname, '../../public/static')
    : path.join(resourcesPath, 'static');
};
