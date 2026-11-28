/* cspell:ignore gbraid gclid wbraid */
import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type IInstallAttributionParams = {
  clickId?: string;
  gadSource?: string;
  gbraid?: string;
  gclid?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmId?: string;
  utmMedium?: string;
  utmSource?: string;
  utmTerm?: string;
  wbraid?: string;
};

export type IAppClipInstallAttributionParams = IInstallAttributionParams & {
  campaignId?: string;
  experience?: string;
  firstOpenedAt?: string;
  lastAction?: string;
  route?: string;
  selectedAddress?: string;
  selectedIsNative?: boolean;
  selectedNetwork?: string;
  selectedSymbol?: string;
  shortLinkPath?: string;
  shortLinkVersion?: number;
};

export class InstallScene extends BaseScene {
  @LogToServer({ level: 'info', waitForServer: true })
  private installAttribution(params: IInstallAttributionParams) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  private installAttributionDiagnostic(params: IInstallAttributionParams) {
    return params;
  }

  public reportGooglePlayInstallAttribution(
    params: IInstallAttributionParams,
  ): Promise<void> {
    const {
      gbraid: _gbraid,
      gclid: _gclid,
      wbraid: _wbraid,
      ...diagnostics
    } = params;
    this.installAttributionDiagnostic(diagnostics);
    return this.installAttribution(params) as unknown as Promise<void>;
  }

  public reportAppClipInstallAttribution(
    params: IAppClipInstallAttributionParams,
  ): Promise<void> {
    this.installAttributionDiagnostic(params);
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
