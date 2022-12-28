import { join } from 'path';

const resolveStaticPath = (path: string) => {
  const staticPath = join('/static', path);

  return staticPath;
};

export const getConnectSrc = () => resolveStaticPath('js-sdk/');
