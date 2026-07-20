import type { IHardwareUiPayload } from '../../states/jotai/atoms';

type IWalletSessionUiMetadata = {
  existsAttachPinUser?: boolean;
  source?: 'wallet-session-coordinator';
  reason?: 'open-wallet' | 'session-recovery';
  expectedPassphraseState?: string;
};

export function copyWalletSessionUiMetadata(
  target: IHardwareUiPayload,
  source: IWalletSessionUiMetadata,
) {
  target.existsAttachPinUser = source.existsAttachPinUser;
  target.source = source.source;
  target.reason = source.reason;
  target.expectedPassphraseState = source.expectedPassphraseState;
  return target;
}
