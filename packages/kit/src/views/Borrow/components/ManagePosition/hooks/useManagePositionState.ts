import { useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IToken } from '@onekeyhq/shared/types/token';

import type { IManagePositionProps, IManagePositionState } from '../types';

export function useManagePositionState(props: IManagePositionProps): {
  state: Omit<
    IManagePositionState,
    | 'amountValue'
    | 'submitting'
    | 'tokenSelectorMode'
    | 'tokenSelectorTriggerProps'
  >;
  amountValue: string;
  setAmountValue: (value: string) => void;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
} {
  const [amountValue, setAmountValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [
    {
      currencyInfo: { symbol: currencySymbol },
    },
  ] = useSettingsPersistAtom();

  // Network info
  const { result: network } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId: props.networkId,
      }),
    [props.networkId],
  );

  // Price normalization
  const price = useMemo(
    () => (Number(props.price) > 0 ? props.price! : '0'),
    [props.price],
  );

  // Token
  const token = useMemo(
    () => props.tokenInfo?.token as IToken | undefined,
    [props.tokenInfo?.token],
  );

  // Max amount calculation
  const maxAmountValue = useMemo(() => {
    const valueForMax = props.maxBalance ?? props.balance;
    const valueBN = new BigNumber(valueForMax);
    if (valueBN.isNaN()) return '0';
    if (typeof props.decimals === 'number') {
      return valueBN
        .decimalPlaces(props.decimals, BigNumber.ROUND_DOWN)
        .toFixed();
    }
    return valueForMax;
  }, [props.balance, props.maxBalance, props.decimals]);

  // Current fiat value
  const currentValue = useMemo(() => {
    if (Number(amountValue) > 0 && Number(price) > 0) {
      return BigNumber(amountValue).multipliedBy(price).toFixed();
    }
    return undefined;
  }, [amountValue, price]);

  // Validation: is amount invalid
  const isAmountInvalid = useMemo(
    () =>
      BigNumber(amountValue).isNaN() ||
      (typeof amountValue === 'string' && amountValue.endsWith('.')),
    [amountValue],
  );

  // Validation: insufficient balance
  const isInsufficientBalance = useMemo(() => {
    const amountBN = new BigNumber(amountValue);
    const balanceBN = new BigNumber(props.balance);
    if (amountBN.isNaN() || balanceBN.isNaN()) return false;
    return amountBN.gt(balanceBN);
  }, [amountValue, props.balance]);

  // Action-specific "all" flags
  const isWithdrawAll = useMemo(() => {
    if (props.action !== 'withdraw') return false;
    const amountBN = new BigNumber(amountValue);
    const maxAmountBN = new BigNumber(maxAmountValue);
    if (amountBN.isNaN() || maxAmountBN.isNaN()) return false;
    return amountBN.gt(0) && amountBN.eq(maxAmountBN);
  }, [props.action, amountValue, maxAmountValue]);

  const isRepayAll = useMemo(() => {
    if (props.action !== 'repay') return false;
    const amountBN = new BigNumber(amountValue);
    const maxAmountBN = new BigNumber(maxAmountValue);
    if (amountBN.isNaN() || maxAmountBN.isNaN()) return false;
    return amountBN.gt(0) && amountBN.eq(maxAmountBN);
  }, [props.action, amountValue, maxAmountValue]);

  const state: Omit<
    IManagePositionState,
    | 'amountValue'
    | 'submitting'
    | 'tokenSelectorMode'
    | 'tokenSelectorTriggerProps'
  > = useMemo(
    () => ({
      // Core identifiers
      accountId: props.accountId,
      networkId: props.networkId,
      providerName: props.providerName,
      borrowMarketAddress: props.borrowMarketAddress,
      borrowReserveAddress: props.borrowReserveAddress,

      // Action configuration
      action: props.action,
      actionLabel: props.actionLabel,

      // Token info
      tokenSymbol: props.tokenSymbol,
      tokenImageUri: props.tokenImageUri,
      decimals: props.decimals,
      price,
      balance: props.balance,
      maxBalance: props.maxBalance,
      tokenInfo: props.tokenInfo,
      token,

      // Network info
      networkLogoURI: network?.logoURI,

      // UI state
      isDisabled: props.isDisabled ?? false,
      isInModalContext: props.isInModalContext ?? true,

      // Derived values
      maxAmountValue,
      currentValue,
      currencySymbol,

      // Validation state
      isInsufficientBalance,
      isAmountInvalid,

      // Action-specific flags
      isWithdrawAll,
      isRepayAll,

      // Token selection
      selectableAssets: props.selectableAssets,
      selectableAssetsLoading: props.selectableAssetsLoading,

      // UI configuration
      showApyDetail: props.showApyDetail ?? false,
      beforeFooter: props.beforeFooter,
    }),
    [
      props.accountId,
      props.networkId,
      props.providerName,
      props.borrowMarketAddress,
      props.borrowReserveAddress,
      props.action,
      props.actionLabel,
      props.tokenSymbol,
      props.tokenImageUri,
      props.decimals,
      props.balance,
      props.maxBalance,
      props.tokenInfo,
      props.isDisabled,
      props.isInModalContext,
      props.selectableAssets,
      props.selectableAssetsLoading,
      props.showApyDetail,
      props.beforeFooter,
      price,
      token,
      network?.logoURI,
      maxAmountValue,
      currentValue,
      currencySymbol,
      isInsufficientBalance,
      isAmountInvalid,
      isWithdrawAll,
      isRepayAll,
    ],
  );

  return {
    state,
    amountValue,
    setAmountValue,
    submitting,
    setSubmitting,
  };
}
