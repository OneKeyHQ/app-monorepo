import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type IGooglePlayInstallAttributionParams = {
  clickId?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmId?: string;
  utmMedium?: string;
  utmSource?: string;
  utmTerm?: string;
};

export class InstallScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public installReferrer(rawReferrer: string) {
    return rawReferrer;
  }

  @LogToServer({ level: 'info', waitForServer: true })
  @LogToLocal({ level: 'info' })
  public googlePlayInstallAttribution(
    params: IGooglePlayInstallAttributionParams,
  ) {
    return params;
  }

  @LogToLocal({ level: 'error' })
  public test(a: string, b: number) {
    return [a, b];
  }

  @LogToLocal({ level: 'info' })
  public sum(a: number, b: number) {
    return [a, b];
  }
}
