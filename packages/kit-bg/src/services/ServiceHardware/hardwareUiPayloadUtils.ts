import type { IHardwareUiPayload } from '../../states/jotai/atoms';

type IWalletSessionUiMetadata = {
  existsAttachPinUser?: boolean;
  deviceOnly?: boolean;
  source?: 'wallet-session-coordinator';
  reason?: 'open-wallet' | 'session-recovery';
  expectedPassphraseState?: string;
};

export function copyWalletSessionUiMetadata(
  target: IHardwareUiPayload,
  source: IWalletSessionUiMetadata,
) {
  target.existsAttachPinUser = source.existsAttachPinUser;
  target.deviceOnly = source.deviceOnly;
  target.source = source.source;
  target.reason = source.reason;
  target.expectedPassphraseState = source.expectedPassphraseState;
  return target;
}
