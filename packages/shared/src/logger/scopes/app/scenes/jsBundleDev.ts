import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class JsBundleDevScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public fetchBundleVersions(data: {
    resultCount: number;
    versions: { version: string; bundleCount: number }[];
  }) {
    return data;
  }

  @LogToLocal({ level: 'info' })
  public fetchBundleVersionsError(error: string) {
    return { error };
  }

  @LogToLocal({ level: 'info' })
  public fetchBundles(data: {
    version: string;
    resultCount: number;
    bundles: {
      bundleVersion: string;
      downloadUrl: string;
      sha256: string;
      fileSize: number;
    }[];
  }) {
    return data;
  }

  @LogToLocal({ level: 'info' })
  public fetchBundlesError(data: { version: string; error: string }) {
    return data;
  }

  @LogToLocal({ level: 'info' })
  public downloadBundle(data: {
    version: string;
    bundleVersion: string;
    downloadUrl: string;
    fileSize: number;
  }) {
    return data;
  }

  @LogToLocal({ level: 'info' })
  public downloadBundleResult(data: {
    version: string;
    bundleVersion: string;
    success: boolean;
    error?: string;
  }) {
    return data;
  }

  @LogToLocal({ level: 'info' })
  public installBundle(data: { version: string; bundleVersion: string }) {
    return data;
  }

  @LogToLocal({ level: 'info' })
  public installBundleResult(data: {
    version: string;
    bundleVersion: string;
    success: boolean;
    error?: string;
  }) {
    return data;
  }

  @LogToLocal({ level: 'info' })
  public checkBundleExists(data: {
    version: string;
    bundleVersion: string;
    exists: boolean;
  }) {
    return data;
  }
}
