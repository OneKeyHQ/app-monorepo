import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { UserCancel } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { LOCAL_WALLET_SYNC_TIMEOUT_MESSAGE } from '../vaults/localWallet/userFacingError';

import {
  getPrivacyChainWalletType,
  getPrivacyEnableFailureReason,
  getPrivacyFirstSyncFailureReason,
  getPrivacySyncDurationBucket,
} from './PrivacyChainActivationTracking';

const withCode = (code: string) =>
  Object.assign(new OneKeyLocalError(code), { code });

describe('privacy activation tracking', () => {
  it('names the wallet kind from the account id only', () => {
    expect(getPrivacyChainWalletType('hd-1--0')).toBe('hd');
    expect(getPrivacyChainWalletType("hw-abc--m/44'/133'/0'")).toBe('hw');
    expect(getPrivacyChainWalletType('imported--0')).toBe('other');
  });

  it('sorts enable failures into coarse categories', () => {
    expect(
      getPrivacyEnableFailureReason(
        Object.assign(new OneKeyLocalError('x'), {
          className: 'PasswordPromptDialogCancel',
        }),
      ),
    ).toBe('user_cancelled');
    expect(getPrivacyEnableFailureReason(new UserCancel())).toBe(
      'user_cancelled',
    );
    expect(
      getPrivacyEnableFailureReason(
        Object.assign(new OneKeyLocalError('device'), {
          $isHardwareError: true,
          code: HardwareErrorCode.DeviceNotFound,
        }),
      ),
    ).toBe('device_error');
    expect(
      getPrivacyEnableFailureReason(
        new OneKeyLocalError({ key: ETranslations.privacy_slots_delete__desc }),
      ),
    ).toBe('limit_reached');
    expect(getPrivacyEnableFailureReason(withCode('STORAGE_UNSUPPORTED'))).toBe(
      'storage_unsupported',
    );
    expect(getPrivacyEnableFailureReason(withCode('NETWORK_ERROR'))).toBe(
      'node_unreachable',
    );
    expect(getPrivacyEnableFailureReason(new Error('t1abc failed'))).toBe(
      'unknown',
    );
  });

  it('sorts first sync failures into coarse categories', () => {
    expect(
      getPrivacyFirstSyncFailureReason(
        new OneKeyLocalError(LOCAL_WALLET_SYNC_TIMEOUT_MESSAGE),
      ),
    ).toBe('timeout');
    expect(getPrivacyFirstSyncFailureReason(withCode('NETWORK_ERROR'))).toBe(
      'node_unreachable',
    );
    expect(
      getPrivacyFirstSyncFailureReason(withCode('STORAGE_UNSUPPORTED')),
    ).toBe('storage_unsupported');
    expect(
      getPrivacyFirstSyncFailureReason(
        new OneKeyLocalError({
          message: 'worker gone',
          data: { privacyChainRuntimeFailure: 'handshake' },
        }),
      ),
    ).toBe('runtime_unavailable');
    expect(getPrivacyFirstSyncFailureReason(new Error('boom'))).toBe('failed');
  });

  it('buckets durations coarsely', () => {
    const minutes = (value: number) => value * 60_000;
    expect(getPrivacySyncDurationBucket(minutes(4.9))).toBe('under_5m');
    expect(getPrivacySyncDurationBucket(minutes(5))).toBe('5m_30m');
    expect(getPrivacySyncDurationBucket(minutes(30))).toBe('30m_2h');
    expect(getPrivacySyncDurationBucket(minutes(120))).toBe('2h_6h');
    expect(getPrivacySyncDurationBucket(minutes(360))).toBe('over_6h');
  });
});
