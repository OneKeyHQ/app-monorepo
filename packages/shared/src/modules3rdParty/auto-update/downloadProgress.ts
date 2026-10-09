import { EUpdateFileType, getUpdateFileType } from '../../appUpdate';
import platformEnv from '../../platformEnv';

import type { IDownloadProgressScope } from './type';
import type { IAppUpdateInfo } from '../../appUpdate';

export function getAppUpdateProgressScope(
  info: IAppUpdateInfo,
): IDownloadProgressScope | undefined {
  if (getUpdateFileType(info) !== EUpdateFileType.jsBundle) return undefined;
  return {
    latestVersion: info.latestVersion || platformEnv.version,
    bundleVersion: info.jsBundleVersion,
  };
}
