import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { OneKeyError } from '@onekeyhq/engine/src/errors';
import {
  OneKeyErrorClassNames,
  OneKeyValidatorError,
  OneKeyValidatorTip,
} from '@onekeyhq/engine/src/errors';
import type {
  IEncodedTx,
  IFeeInfoSelectedType,
} from '@onekeyhq/engine/src/vaults/types';
import type { CustomAlert } from '@onekeyhq/kit/src/views/Send/modals/SendEditFee/SendEditFeeCustomForm';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../../hooks';

export function useBtcCustomFeeForm({
  networkId,
  accountId,
  encodedTx,
  setGasPriceTip,
  firstPresetFeeInfo,
  lastPresetFeeInfo,
}: {
  networkId: string;
  accountId: string;
  encodedTx?: IEncodedTx;
  setGasPriceTip: Dispatch<SetStateAction<CustomAlert>>;
  firstPresetFeeInfo: string;
  lastPresetFeeInfo: string;
}) {
  const intl = useIntl();

  const validateFeeRate = useCallback(
    async ({
      value,
      lowValue,
      highValue,
    }: {
      value: string;
      lowValue: string;
      highValue: string;
    }) => {
      const min = 0;
      const max = 1000000;
      const valueBN = new BigNumber(value);
      if (valueBN.isLessThanOrEqualTo(min) || valueBN.isGreaterThan(max)) {
        throw new OneKeyValidatorError(
          'msg__enter_a_fee_rate_between_str_and_str',
          {
            min: '0',
            max: '1000000',
          },
        );
      }

      // check balance
      try {
        if (encodedTx) {
          await backgroundApiProxy.engine.attachFeeInfoToEncodedTx({
            networkId,
            accountId,
            encodedTx,
            feeInfoValue: {
              feeRate: value,
            },
          });
        }
      } catch (e) {
        throw new OneKeyValidatorError('msg__insufficient_balance');
      }

      if (valueBN.shiftedBy(-8).isLessThan(lowValue)) {
        throw new OneKeyValidatorTip(
          'msg__fee_rate_is_low_for_current_network',
        );
      }
      if (
        valueBN.shiftedBy(-8).isGreaterThan(new BigNumber(highValue).times(10))
      ) {
        throw new OneKeyValidatorTip('msg__fee_rate_is_higher_than_necessary');
      }
    },
    [accountId, encodedTx, networkId],
  );

  const feeRateFormValidator = useCallback(
    async ({ value }: { value: string }) => {
      const lowValue = firstPresetFeeInfo;
      const highValue = lastPresetFeeInfo;
      try {
        await validateFeeRate({
          value,
          lowValue,
          highValue,
        });
        setGasPriceTip(null);
      } catch (error) {
        const e = error as OneKeyError;
        if (e?.className === OneKeyErrorClassNames.OneKeyValidatorError) {
          setGasPriceTip({
            type: 'error',
            message: intl.formatMessage(
              {
                id: e.key as any,
              },
              e.info,
            ),
          });
          return false;
        }
        if (e?.className === OneKeyErrorClassNames.OneKeyValidatorTip) {
          setGasPriceTip({
            type: 'warn',
            message: intl.formatMessage(
              {
                id: e.key as any,
              },
              e.info,
            ),
          });
        }
      }
      return true;
    },
    [
      firstPresetFeeInfo,
      intl,
      lastPresetFeeInfo,
      setGasPriceTip,
      validateFeeRate,
    ],
  );
  return {
    feeRateFormValidator,
  };
}

export function useBtcCustomFee({
  networkId,
  accountId,
  feeRate,
  feeType,
  encodedTx,
}: {
  networkId: string;
  accountId: string;
  feeRate: string;
  feeType: IFeeInfoSelectedType;
  encodedTx?: IEncodedTx;
}) {
  const [btcTxFee, setBtcTxFee] = useState<string | null>(null);
  const debounceFeeRate = useDebounce(feeRate, 300);
  useEffect(() => {
    if (encodedTx && debounceFeeRate && feeType === 'custom') {
      backgroundApiProxy.engine
        .fetchFeeInfo({
          networkId,
          accountId,
          encodedTx,
          specifiedFeeRate: debounceFeeRate,
        })
        .then((feeInfo) => {
          setBtcTxFee(`${feeInfo.feeList?.[0] || 0}`);
        })
        .catch(() => {
          setBtcTxFee(null);
        });
    }
  }, [debounceFeeRate, feeType, networkId, accountId, encodedTx]);

  return {
    btcTxFee,
  };
}
