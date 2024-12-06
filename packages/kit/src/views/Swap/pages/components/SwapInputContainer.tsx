import { memo, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import {
  useRateDifferenceAtom,
  useSwapAlertsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapRateDifferenceUnit,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapSelectedTokenInfo } from '../../hooks/useSwapTokens';

import SwapAccountAddressContainer from './SwapAccountAddressContainer';
import SwapPercentageInput from './SwapPercentageInput';

interface ISwapInputContainerProps {
  direction: ESwapDirectionType;
  token?: ISwapToken;
  onAmountChange?: (value: string) => void;
  amountValue: string;
  onSelectToken: (type: ESwapDirectionType) => void;
  balance: string;
  address?: string;
  inputLoading?: boolean;
  selectTokenLoading?: boolean;
  onBalanceMaxPress?: () => void;
  onSelectPercentageStage?: (stage: number) => void;
}

const SwapInputContainer = ({
  onAmountChange,
  direction,
  token,
  amountValue,
  selectTokenLoading,
  inputLoading,
  onSelectToken,
  onBalanceMaxPress,
  onSelectPercentageStage,
  balance,
}: ISwapInputContainerProps) => {
  useSwapSelectedTokenInfo({
    token,
    type: direction,
  });
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [alerts] = useSwapAlertsAtom();
  const { address, accountInfo } = useSwapAddressInfo(direction);
  const [rateDifference] = useRateDifferenceAtom();
  const amountPrice = useMemo(() => {
    if (!token?.price) return '0.0';
    const tokenPriceBN = new BigNumber(token.price ?? 0);
    const tokenFiatValueBN = new BigNumber(amountValue ?? 0).multipliedBy(
      tokenPriceBN,
    );
    return tokenFiatValueBN.isNaN()
      ? '0.0'
      : `${tokenFiatValueBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed()}`;
  }, [amountValue, token?.price]);

  const fromInputHasError = useMemo(
    () =>
      (alerts?.states.some((item) => item.inputShowError) &&
        direction === ESwapDirectionType.FROM) ||
      (!address &&
        (accountUtils.isHdWallet({ walletId: accountInfo?.wallet?.id }) ||
          accountUtils.isHwWallet({ walletId: accountInfo?.wallet?.id }) ||
          accountUtils.isQrWallet({ walletId: accountInfo?.wallet?.id }))),
    [alerts?.states, direction, address, accountInfo],
  );

  const valueMoreComponent = useMemo(() => {
    if (rateDifference && direction === ESwapDirectionType.TO) {
      let color = '$textSubdued';
      if (inputLoading) {
        color = '$textPlaceholder';
      }
      if (rateDifference.unit === ESwapRateDifferenceUnit.NEGATIVE) {
        color = '$textCritical';
      }
      if (rateDifference.unit === ESwapRateDifferenceUnit.POSITIVE) {
        color = '$textSuccess';
      }
      return (
        <SizableText size="$bodyMd" color={color}>
          {rateDifference.value}
        </SizableText>
      );
    }
    return null;
  }, [direction, inputLoading, rateDifference]);

  const [percentageInputStageShow, setPercentageInputStageShow] =
    useState(false);

  const onFromInputFocus = () => {
    setPercentageInputStageShow(true);
  };

  const onFromInputBlur = () => {
    setPercentageInputStageShow(false);
  };

  const showPercentageInput = useMemo(
    () =>
      direction === ESwapDirectionType.FROM &&
      (percentageInputStageShow || !!amountValue),
    [direction, percentageInputStageShow, amountValue],
  );

  return (
    <YStack>
      <XStack justifyContent="space-between">
        <SwapAccountAddressContainer
          type={direction}
          onClickNetwork={onSelectToken}
        />
        <SwapPercentageInput
          show={showPercentageInput}
          onSelectStage={onSelectPercentageStage}
        />
      </XStack>
      <AmountInput
        onChange={onAmountChange}
        value={amountValue}
        onFocus={onFromInputFocus}
        onBlur={onFromInputBlur}
        hasError={fromInputHasError}
        balanceProps={{
          value: balance,
          onPress:
            direction === ESwapDirectionType.FROM && !token?.isNative
              ? onBalanceMaxPress
              : undefined,
        }}
        valueProps={{
          value: amountPrice,
          color:
            inputLoading && direction === ESwapDirectionType.TO
              ? '$textPlaceholder'
              : undefined,
          currency: settingsPersistAtom.currencyInfo.symbol,
          moreComponent: valueMoreComponent,
        }}
        inputProps={{
          placeholder: '0.0',
          readOnly: direction === ESwapDirectionType.TO,
          color:
            direction === ESwapDirectionType.TO && inputLoading
              ? '$textPlaceholder'
              : undefined,
          style:
            !platformEnv.isNative && direction === ESwapDirectionType.TO
              ? ({
                  caretColor: 'transparent',
                } as any)
              : undefined,
        }}
        tokenSelectorTriggerProps={{
          loading: selectTokenLoading,
          selectedNetworkImageUri: token?.networkLogoURI,
          selectedTokenImageUri: token?.logoURI,
          selectedTokenSymbol: token?.symbol,
          onPress: () => {
            onSelectToken(direction);
          },
        }}
        enableMaxAmount={
          !!(direction === ESwapDirectionType.FROM && !token?.isNative)
        }
      />
    </YStack>
  );
};

export default memo(SwapInputContainer);
