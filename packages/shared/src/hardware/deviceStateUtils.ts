import { EOneKeyDeviceMode } from '../../types/device';
import deviceUtils from '../utils/deviceUtils';

import type {
  IOneKeyDeviceFeatures,
  IOneKeyDeviceState,
} from '../../types/device';

const isConfirmedDeviceId = (value?: string | null): value is string =>
  typeof value === 'string' && value.length > 0;

const nullableToUndefined = (value?: string | null) => value ?? undefined;

const isLoaderMode = (mode?: string | null) =>
  mode === EOneKeyDeviceMode.bootloader || mode === EOneKeyDeviceMode.romloader;

export function hasDeviceStateIdentityMismatch({
  currentDeviceId,
  incomingDeviceId,
}: {
  currentDeviceId?: string | null;
  incomingDeviceId?: string | null;
}) {
  return (
    isConfirmedDeviceId(currentDeviceId) &&
    isConfirmedDeviceId(incomingDeviceId) &&
    currentDeviceId !== incomingDeviceId
  );
}

function sanitizeState(state: IOneKeyDeviceState) {
  const nextState = structuredClone(state);
  delete (nextState as unknown as { raw?: unknown }).raw;
  delete (nextState as unknown as { session?: unknown }).session;
  return nextState;
}

function updateDisplayName(state: IOneKeyDeviceState) {
  const { identity } = state;
  const defaultName = identity.deviceType
    ? deviceUtils.getDefaultDeviceLabel(identity.deviceType)
    : undefined;
  identity.displayName =
    identity.label ||
    identity.bleName ||
    defaultName ||
    identity.model ||
    'OneKey';
}

export function mergeDeviceStateEvent({
  currentState,
  incomingState,
  changedKeys,
}: {
  currentState?: IOneKeyDeviceState;
  incomingState: IOneKeyDeviceState;
  changedKeys: string[];
}): IOneKeyDeviceState {
  if (!currentState) {
    const initialState = sanitizeState(incomingState);
    updateDisplayName(initialState);
    return initialState;
  }

  let mergedState = sanitizeState(currentState);
  for (const changedKey of changedKeys) {
    const isNonPersistedKey =
      changedKey === 'identity.displayName' ||
      changedKey === 'raw' ||
      changedKey === 'session';
    if (isNonPersistedKey) {
      // Ignore SDK-internal and derived fields.
    } else if (changedKey === '*') {
      mergedState = sanitizeState(incomingState);
      break;
    } else {
      const [section, field] = changedKey.split('.');
      const incomingRecord = incomingState as unknown as Record<
        string,
        unknown
      >;
      const mergedRecord = mergedState as unknown as Record<string, unknown>;
      if (!field) {
        if (section in incomingRecord) {
          mergedRecord[section] = structuredClone(incomingRecord[section]);
        }
      } else {
        const incomingSection = incomingRecord[section];
        if (incomingSection && typeof incomingSection === 'object') {
          const targetSection =
            mergedRecord[section] && typeof mergedRecord[section] === 'object'
              ? (mergedRecord[section] as Record<string, unknown>)
              : {};
          targetSection[field] = structuredClone(
            (incomingSection as Record<string, unknown>)[field],
          );
          mergedRecord[section] = targetSection;
        }
      }
    }
  }

  if (
    isConfirmedDeviceId(currentState.identity.deviceId) &&
    !isConfirmedDeviceId(incomingState.identity.deviceId)
  ) {
    mergedState.identity.deviceId = currentState.identity.deviceId;
  }
  mergedState.schemaVersion = incomingState.schemaVersion;
  mergedState.revision = incomingState.revision;
  mergedState.updatedAt = incomingState.updatedAt;
  mergedState.protocol = incomingState.protocol;
  updateDisplayName(mergedState);
  return mergedState;
}

/**
 * DeviceState is the source of truth. This projection only keeps legacy App
 * consumers working while they still read the persisted Features shape.
 */
export function projectLegacyDeviceFeaturesFromState(
  state: IOneKeyDeviceState,
): IOneKeyDeviceFeatures {
  const { identity, status, settings, versions, verification } = state;
  const loaderMode = isLoaderMode(status.mode);

  return {
    onekey_serial_no: identity.serialNo,
    onekey_ble_name: identity.bleName || '',
    onekey_firmware_version: nullableToUndefined(versions.firmware),
    onekey_boot_version: nullableToUndefined(versions.bootloader),
    onekey_board_version: nullableToUndefined(versions.board),
    onekey_ble_version: nullableToUndefined(versions.ble),
    onekey_firmware_hash: verification?.firmwareHash,
    onekey_boot_hash: verification?.bootloaderHash,
    onekey_board_hash: verification?.boardHash,
    onekey_ble_hash: verification?.bleHash,
    onekey_firmware_build_id: verification?.firmwareBuildId,
    onekey_boot_build_id: verification?.bootloaderBuildId,
    onekey_board_build_id: verification?.boardBuildId,
    onekey_ble_build_id: verification?.bleBuildId,
    onekey_se01_version: nullableToUndefined(versions.se01),
    onekey_se02_version: nullableToUndefined(versions.se02),
    onekey_se03_version: nullableToUndefined(versions.se03),
    onekey_se04_version: nullableToUndefined(versions.se04),
    onekey_se01_hash: verification?.se01Hash,
    onekey_se02_hash: verification?.se02Hash,
    onekey_se03_hash: verification?.se03Hash,
    onekey_se04_hash: verification?.se04Hash,
    onekey_se01_build_id: verification?.se01BuildId,
    onekey_se02_build_id: verification?.se02BuildId,
    onekey_se03_build_id: verification?.se03BuildId,
    onekey_se04_build_id: verification?.se04BuildId,
    onekey_se01_boot_version: nullableToUndefined(versions.se01Boot),
    onekey_se02_boot_version: nullableToUndefined(versions.se02Boot),
    onekey_se03_boot_version: nullableToUndefined(versions.se03Boot),
    onekey_se04_boot_version: nullableToUndefined(versions.se04Boot),
    onekey_se01_boot_hash: verification?.se01BootHash,
    onekey_se02_boot_hash: verification?.se02BootHash,
    onekey_se03_boot_hash: verification?.se03BootHash,
    onekey_se04_boot_hash: verification?.se04BootHash,
    onekey_se01_boot_build_id: verification?.se01BootBuildId,
    onekey_se02_boot_build_id: verification?.se02BootBuildId,
    onekey_se03_boot_build_id: verification?.se03BootBuildId,
    onekey_se04_boot_build_id: verification?.se04BootBuildId,
    onekey_device_type: identity.deviceType,
    protocol: state.protocol,
    protocolVersion: state.protocol === 'V2' ? 2 : 1,
    deviceType: identity.deviceType,
    firmwareType: identity.firmwareType,
    model: identity.model,
    vendor: identity.vendor,
    deviceId: identity.deviceId,
    serialNo: identity.serialNo,
    label: identity.label,
    bleName: identity.bleName,
    capabilities: state.capabilities,
    mode: status.mode,
    initialized: status.initialized,
    bootloaderMode: loaderMode,
    unlocked: status.unlocked,
    firmwarePresent: status.firmwarePresent,
    passphraseProtection: status.passphraseProtection,
    pinProtection: status.pinProtection,
    backupRequired: status.backupRequired,
    noBackup: status.noBackup,
    unfinishedBackup: status.unfinishedBackup,
    recoveryMode: status.recoveryMode,
    language: settings.language,
    bleEnabled: settings.bleEnabled,
    sdCardPresent: settings.sdCardPresent,
    sdProtection: settings.sdProtection,
    wipeCodeProtection: settings.wipeCodeProtection,
    passphraseAlwaysOnDevice: settings.passphraseAlwaysOnDevice,
    attachToPinEnabled: status.attachToPinEnabled,
    safetyChecks: settings.safetyChecks,
    autoLockDelayMs: settings.autoLockDelayMs,
    autoShutdownDelayMs: settings.autoShutdownDelayMs,
    displayRotation: settings.displayRotation,
    experimentalFeatures: settings.experimentalFeatures,
    wallpaperPath: settings.wallpaperPath,
    brightness: settings.brightness,
    animationEnabled: settings.animationEnabled,
    tapToWake: settings.tapToWake,
    hapticFeedback: settings.hapticFeedback,
    deviceNameDisplayEnabled: settings.deviceNameDisplayEnabled,
    airgapMode: settings.airgapMode,
    fidoEnabled: settings.fidoEnabled,
    usbLockEnabled: settings.usbLockEnabled,
    randomKeypad: settings.randomKeypad,
    firmwareVersion: versions.firmware,
    bootloaderVersion: versions.bootloader,
    boardVersion: versions.board,
    bleVersion: versions.ble,
    se01Version: versions.se01,
    se02Version: versions.se02,
    se03Version: versions.se03,
    se04Version: versions.se04,
    se01BootVersion: versions.se01Boot,
    se02BootVersion: versions.se02Boot,
    se03BootVersion: versions.se03Boot,
    se04BootVersion: versions.se04Boot,
    verify: verification,
    sessionId: null,
    unlockedAttachPin: status.unlockedAttachPin ?? undefined,
    device_id: identity.deviceId ?? undefined,
    bootloader_mode: loaderMode,
    passphrase_protection: status.passphraseProtection ?? undefined,
    pin_protection: status.pinProtection ?? undefined,
  };
}
