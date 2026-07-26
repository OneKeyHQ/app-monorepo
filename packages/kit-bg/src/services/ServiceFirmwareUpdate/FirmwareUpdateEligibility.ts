import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';

import type { IFirmwareUpdateJournalUserAttestation } from './firmwareUpdateCoordinatorTypes';

export const FIRMWARE_UPDATE_COMPATIBILITY_DEV_SETTING_KEYS = Object.freeze([
  'shouldUpdateBridge',
  'allIsUpToDate',
  'forceUpdateFirmware',
  'forceUpdateBle',
  'forceUpdateBootloader',
  'forceUpdateOnceFirmware',
  'forceUpdateOnceBle',
  'forceUpdateOnceBootloader',
  'forceUpdateResEvenSameVersion',
  'shouldUpdateFullRes',
  'shouldUpdateFromWeb',
  'updateDevDeviceBootloaderOnAppAllowed',
  'lowBatteryLevel',
] as const);

export type IFirmwareUpdateUserConfirmationDto = {
  backuped: boolean;
  usbConnected: boolean;
};

export type IFirmwareUpdateEligibilityDependencies<TContext> = {
  now: () => number;
  digestAttestation: (value: unknown) => Promise<string>;
  validateFullResource: (context: TContext) => Promise<void>;
  validateMinimumVersions: (context: TContext) => Promise<void>;
  validateBridge: (context: TContext) => Promise<void>;
  validateBattery: (context: TContext) => Promise<void>;
  revalidateConnection: (context: TContext) => Promise<void>;
  revalidateIdentity: (context: TContext) => Promise<void>;
};

const defaultDigestAttestation = async (value: unknown) => {
  const sdk = await CoreSDKLoader();
  return sdk.sha256CanonicalFirmwareJson(value);
};

const invalidConfirmation = (message: string): never => {
  throw Object.assign(new OneKeyLocalError(message), {
    firmwareUpdateEligibilityCode: 'INVALID_USER_CONFIRMATION',
  });
};

const assertExactConfirmationDto = (
  value: unknown,
): IFirmwareUpdateUserConfirmationDto => {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return invalidConfirmation(
      'Firmware update confirmations must be a plain object',
    );
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 2 ||
    !keys.includes('backuped') ||
    !keys.includes('usbConnected') ||
    typeof record.backuped !== 'boolean' ||
    typeof record.usbConnected !== 'boolean'
  ) {
    return invalidConfirmation(
      'Firmware update confirmations have an invalid schema',
    );
  }
  return {
    backuped: record.backuped,
    usbConnected: record.usbConnected,
  };
};

const assertValidatedAttestation = (
  attestation: IFirmwareUpdateJournalUserAttestation,
) => {
  if (
    attestation.backuped !== true ||
    attestation.usbConnected !== true ||
    !Number.isSafeInteger(attestation.confirmedAt) ||
    attestation.confirmedAt <= 0 ||
    !/^[0-9a-f]{64}$/u.test(attestation.attestationDigest)
  ) {
    invalidConfirmation('Firmware update confirmation attestation is invalid');
  }
};

export class FirmwareUpdateEligibility<TContext> {
  private readonly dependencies: IFirmwareUpdateEligibilityDependencies<TContext>;

  constructor(
    dependencies: Omit<
      IFirmwareUpdateEligibilityDependencies<TContext>,
      'digestAttestation' | 'now'
    > &
      Partial<
        Pick<
          IFirmwareUpdateEligibilityDependencies<TContext>,
          'digestAttestation' | 'now'
        >
      >,
  ) {
    this.dependencies = {
      now: Date.now,
      digestAttestation: defaultDigestAttestation,
      ...dependencies,
    };
  }

  async createUserAttestation(
    input: unknown,
  ): Promise<IFirmwareUpdateJournalUserAttestation> {
    const dto = assertExactConfirmationDto(input);
    if (!dto.backuped) {
      return invalidConfirmation(
        'Firmware update requires mnemonic backup confirmation',
      );
    }
    if (!dto.usbConnected) {
      return invalidConfirmation(
        'Firmware update requires USB connection confirmation',
      );
    }
    const confirmedAt = this.dependencies.now();
    if (!Number.isSafeInteger(confirmedAt) || confirmedAt <= 0) {
      return invalidConfirmation(
        'Firmware update confirmation timestamp is invalid',
      );
    }
    const canonicalAttestation = {
      schemaVersion: 1,
      backuped: true,
      usbConnected: true,
      confirmedAt,
    };
    const attestationDigest =
      await this.dependencies.digestAttestation(canonicalAttestation);
    if (!/^[0-9a-f]{64}$/u.test(attestationDigest)) {
      return invalidConfirmation(
        'Firmware update confirmation digest is invalid',
      );
    }
    return Object.freeze({
      backuped: true,
      usbConnected: true,
      confirmedAt,
      attestationDigest,
    });
  }

  async assertBeforeAcquisition({
    context,
    attestation,
  }: {
    context: TContext;
    attestation: IFirmwareUpdateJournalUserAttestation;
  }): Promise<void> {
    assertValidatedAttestation(attestation);
    await this.dependencies.validateFullResource(context);
    await this.dependencies.validateMinimumVersions(context);
    await this.dependencies.validateBridge(context);
    await this.dependencies.validateBattery(context);
    await this.dependencies.revalidateConnection(context);
    await this.dependencies.revalidateIdentity(context);
  }

  async assertBeforeDeviceMutation({
    context,
    attestation,
  }: {
    context: TContext;
    attestation: IFirmwareUpdateJournalUserAttestation;
  }): Promise<void> {
    assertValidatedAttestation(attestation);
    await this.dependencies.revalidateConnection(context);
    await this.dependencies.revalidateIdentity(context);
    await this.dependencies.validateBattery(context);
  }
}
