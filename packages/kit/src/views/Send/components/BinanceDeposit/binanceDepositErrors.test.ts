import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EBinanceDepositErrorCode } from '@onekeyhq/shared/types/binanceDeposit';

import {
  getBinanceDepositErrorTitle,
  getBinanceDepositVerifyFailure,
} from './binanceDepositErrors';

import type { IntlShape } from 'react-intl';

// Echoes the message id, so a test reads which copy was picked.
const intl = {
  formatMessage: ({ id }: { id: string }) => id,
} as unknown as IntlShape;

describe('getBinanceDepositErrorTitle', () => {
  it.each([
    [
      EBinanceDepositErrorCode.FeatureDisabled,
      ETranslations.binance_deposit_asset_unavailable__msg,
    ],
    [
      EBinanceDepositErrorCode.DepositDisabled,
      ETranslations.binance_deposit_asset_unavailable__msg,
    ],
    [
      EBinanceDepositErrorCode.CapabilityStale,
      ETranslations.binance_deposit_asset_unavailable__msg,
    ],
    [EBinanceDepositErrorCode.RateLimited, ETranslations.global_request_limit],
    [
      EBinanceDepositLocalErrorCode.RequestFailed,
      ETranslations.binance_deposit_unavailable__msg,
    ],
  ])('titles a refusal with code %s', (code, title) => {
    expect(getBinanceDepositErrorTitle(intl, { code })).toBe(title);
  });

  it('falls back to the generic copy for an error without a code', () => {
    expect(getBinanceDepositErrorTitle(intl, new Error('offline'))).toBe(
      ETranslations.binance_deposit_unavailable__msg,
    );
  });
});

describe('getBinanceDepositVerifyFailure', () => {
  it('reads only a failed verification as a conflict', () => {
    expect(
      getBinanceDepositVerifyFailure(
        intl,
        EBinanceDepositLocalErrorCode.VerifyFailed,
      ),
    ).toEqual({
      type: 'conflict',
      title: ETranslations.binance_deposit_verify_failed__title,
      message: ETranslations.binance_deposit_verify_failed__desc,
    });
  });

  it('sends a gone address back for a new one', () => {
    expect(
      getBinanceDepositVerifyFailure(
        intl,
        EBinanceDepositLocalErrorCode.DestinationInvalid,
      ),
    ).toEqual({
      type: 'invalid',
      title: ETranslations.binance_deposit_address_invalid__title,
      message: ETranslations.binance_deposit_get_new_address__desc,
    });
  });

  it.each([
    EBinanceDepositErrorCode.FeatureDisabled,
    EBinanceDepositErrorCode.DepositDisabled,
    EBinanceDepositErrorCode.RateLimited,
    EBinanceDepositLocalErrorCode.VerifyUnavailable,
    undefined,
  ])('leaves code %s undecided', (code) => {
    expect(getBinanceDepositVerifyFailure(intl, code).type).toBe('unavailable');
  });
});
