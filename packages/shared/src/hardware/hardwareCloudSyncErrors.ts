import { OneKeyLocalError } from '../errors';
import { normalizeErrorProps } from '../errors/utils/errorUtils';
import { ETranslations } from '../locale';

const prerequisiteMessages = {
  // Developer settings only, so it stays in English.
  logging:
    'Device debug logging could record the Cloud sync signature. Turn off Settings > Dev mode > App & Firmware Updates > Firmware Update Dev Settings > Show Device Debug Log, then try again.',
  transport:
    'Connect your hardware wallet directly via USB or Bluetooth to sync.',
  compatibility: "Hardware wallet encryption isn't supported on this platform.",
  walletMismatch:
    "This hardware wallet doesn't match the one used for Cloud sync.",
} as const;

const prerequisiteKeys: Partial<
  Record<keyof typeof prerequisiteMessages, ETranslations>
> = {
  transport: ETranslations.cloud_sync_hardware_direct_connection__msg,
  compatibility: ETranslations.cloud_sync_hardware_unavailable__msg,
  walletMismatch: ETranslations.cloud_sync_hardware_wallet_mismatch__msg,
};

export class HardwareCloudKeyPrerequisiteError extends OneKeyLocalError {
  constructor(readonly reason: keyof typeof prerequisiteMessages) {
    super(
      normalizeErrorProps(
        {
          key: prerequisiteKeys[reason],
          // The page asks whether to continue with this hardware wallet.
          autoToast: reason === 'walletMismatch' ? false : undefined,
        },
        { defaultMessage: prerequisiteMessages[reason] },
      ),
    );
  }
}
