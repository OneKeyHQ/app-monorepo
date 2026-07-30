import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type IInstallAttributionParams = {
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
  private installAttribution(params: IInstallAttributionParams) {
    return params;
  }

  public reportGooglePlayInstallAttribution(
    params: IInstallAttributionParams,
  ): Promise<void> {
    return this.installAttribution(params) as unknown as Promise<void>;
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
