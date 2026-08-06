import loggerUtils from '@onekeyhq/shared/src/logger/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type IFirmwareUpdateTraceInputMode =
  | 'artifact-reader'
  | 'bridge-binary'
  | 'sdk-managed';

export type IFirmwareUpdateTraceStage =
  | 'preflight-start'
  | 'lease-created'
  | 'artifact-download-start'
  | 'artifact-download-complete'
  | 'artifact-download-failed'
  | 'artifact-ready'
  | 'preflight-complete'
  | 'reader-complete'
  | 'sdk-handoff'
  | 'device-boundary'
  | 'release-complete'
  | 'sdk-tip';

export type IFirmwareUpdateArtifactTraceSummary = {
  count: number;
  bytes: number;
  firmwareBytes?: number;
  bleBytes?: number;
  bootloaderBytes?: number;
  resourceCount: number;
  resourceBytes: number;
  integrityVerified: boolean;
};

export type IFirmwareUpdateTraceParams = {
  transactionId: string;
  stage: IFirmwareUpdateTraceStage;
  executor?: 'v2' | 'v3' | 'v4';
  sdkMethod?: string;
  inputMode?: IFirmwareUpdateTraceInputMode;
  expectedArtifactCount?: number;
  artifactId?: string;
  artifactRole?: string;
  expectedBytes?: number;
  durationMs?: number;
  errorCode?: string;
  artifacts?: IFirmwareUpdateArtifactTraceSummary;
  preparedPlanProvided?: boolean;
  hostBindingProvided?: boolean;
  readerBytes?: number;
  readerChunks?: number;
  boundaryCode?: string;
  disposition?: 'completed' | 'safeCancelled';
  hostBindingReleased?: boolean;
  leaseReleased?: boolean;
  tipMessage?: string;
};

const getFirmwareUpdateTracePlatform = () => {
  if (platformEnv.isNativeIOS) return 'ios';
  if (platformEnv.isNativeAndroid) return 'android';
  return platformEnv.symbol ?? platformEnv.appPlatform ?? 'web';
};

const stringifyTrace = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
};

export const firmwareUpdateTrace = (
  params: IFirmwareUpdateTraceParams,
): void => {
  loggerUtils.consoleFunc(
    `[FirmwareUpdateTrace] ${stringifyTrace({
      runtime: 'bg',
      platform: getFirmwareUpdateTracePlatform(),
      ...params,
    })}`,
  );
};
