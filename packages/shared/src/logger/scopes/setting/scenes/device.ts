import { encodeBundleVersionForDisplay } from '@onekeyhq/shared/src/appUpdate';
import { BaseScene } from '@onekeyhq/shared/src/logger/base/baseScene';
import { LogToLocal } from '@onekeyhq/shared/src/logger/base/decorators';
import utils from '@onekeyhq/shared/src/logger/utils';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EHardwareTransportType } from '@onekeyhq/shared/types';

export class DeviceScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public logDeviceInfo() {
    return utils.getDeviceInfo();
  }

  @LogToLocal({ level: 'info' })
  public logVersionInfo({
    version,
    nativeAppVersion,
  }: {
    version: string;
    nativeAppVersion: string;
  }) {
    return { version, nativeAppVersion };
  }

  public async logFullVersionInfo() {
    const appVersion = platformEnv.version ?? '';
    const buildNumber = platformEnv.buildNumber ?? '';
    const bundleVersion = platformEnv.bundleVersion ?? '';
    const encodedBundleVersion = encodeBundleVersionForDisplay(bundleVersion);

    const version = `${appVersion}${buildNumber ? `-${buildNumber}` : ''}(${bundleVersion})(${encodedBundleVersion})`;

    let nativeAppVersion = '';
    try {
      const nativeVersion = await BundleUpdate.getNativeAppVersion();
      const nativeBuildNumber = await BundleUpdate.getNativeBuildNumber();
      const builtinBundleVersion = await BundleUpdate.getBuiltinBundleVersion();

      if (nativeVersion) {
        nativeAppVersion = `${nativeVersion}${nativeBuildNumber ? `-${nativeBuildNumber}` : ''}${builtinBundleVersion ? `(${builtinBundleVersion})(${encodeBundleVersionForDisplay(String(builtinBundleVersion))})` : ''}`;
      }
    } catch {
      // ignore errors fetching native version
    }

    this.logVersionInfo({ version, nativeAppVersion });
  }

  @LogToLocal()
  public setForceTransportType({
    forceTransportType,
    operationId,
  }: {
    forceTransportType: EHardwareTransportType;
    operationId: string;
  }) {
    return {
      forceTransportType,
      operationId,
    };
  }

  @LogToLocal()
  public clearForceTransportType() {
    return {};
  }
}
