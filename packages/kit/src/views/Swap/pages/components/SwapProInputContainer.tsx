import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { InputAccessoryView } from 'react-native';

import {
  Divider,
  Icon,
  Image,
  Input,
  Page,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapProDirectionAtom,
  useSwapProInputAmountAtom,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapProUseSelectBuyTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swapProBuyInputSegmentItems,
  swapProSellInputSegmentItems,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
  SwapAmountInputAccessoryViewID,
} from '@onekeyhq/shared/types/swap/types';

import { TokenSelectorPopover } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenSelectorPopover';
import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import SwapProInputSegment from '../../components/SwapProInputSegment';
import {
  useSwapLimitPriceCheck,
  useSwapProInputToken,
  useSwapProToToken,
} from '../../hooks/useSwapPro';

import { PercentageStageOnKeyboard } from './SwapInputContainer';

import type { IToken } from '../../../Market/MarketDetailV2/components/SwapPanel/types';

interface ISwapProInputContainerProps {
  defaultTokens: ISwapTokenBase[];
  defaultLimitTokens: ISwapTokenBase[];
  isLoading?: boolean;
  cleanInputAmount: () => void;
  onSelectPercentageStage: (stage: number) => void;
}

const SwapProInputContainer = ({
  defaultTokens,
  defaultLimitTokens,
  isLoading,
  cleanInputAmount,
  onSelectPercentageStage,
}: ISwapProInputContainerProps) => {
  const intl = useIntl();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const [swapProUseSelectBuyToken, setSwapProUseSelectBuyToken] =
    useSwapProUseSelectBuyTokenAtom();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
  const defaultTokensFromType = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return defaultTokens;
    }
    return defaultLimitTokens;
  }, [swapProTradeType, defaultTokens, defaultLimitTokens]);
  const handleInputChange = useCallback(
    (text: string) => {
      if (validateAmountInput(text, inputToken?.decimals)) {
        if (swapProTradeType === ESwapProTradeType.MARKET) {
          setSwapProInputAmount(text);
        } else {
          setFromInputAmount({
            value: text,
            isInput: true,
          });
        }
      }
    },
    [
      inputToken?.decimals,
      setFromInputAmount,
      setSwapProInputAmount,
      swapProTradeType,
    ],
  );
  const handleTokenSelect = useCallback(
    (token: IToken) => {
      cleanInputAmount();
      setSwapProUseSelectBuyToken(token);
      setIsPopoverOpen(false);
    },
    [setSwapProUseSelectBuyToken, cleanInputAmount],
  );
  const isTokenSelectorVisible =
    swapProDirection === ESwapDirection.BUY && defaultTokensFromType.length > 1;

  const inputSegmentItems = useMemo(() => {
    if (swapProDirection === ESwapDirection.SELL) {
      return swapProSellInputSegmentItems;
    }
    const buyAmountDefaultInput =
      swapProUseSelectBuyToken?.speedSwapDefaultAmount;
    if (buyAmountDefaultInput?.length) {
      return buyAmountDefaultInput.map((item) => ({
        label: item.toString(),
        value: item.toString(),
      }));
    }
    return swapProBuyInputSegmentItems;
  }, [swapProDirection, swapProUseSelectBuyToken?.speedSwapDefaultAmount]);

  const onSelectInputSegment = useCallback(
    (value: string) => {
      if (swapProDirection === ESwapDirection.BUY) {
        handleInputChange(value);
      } else {
        const percentage = new BigNumber(value);
        if (inputToken?.balanceParsed) {
          const balanceBN = new BigNumber(inputToken.balanceParsed);
          const inputNewAmount = balanceBN
            .multipliedBy(percentage)
            .decimalPlaces(inputToken?.decimals ?? 0, BigNumber.ROUND_DOWN)
            .toFixed();
          handleInputChange(inputNewAmount);
        }
      }
    },
    [
      swapProDirection,
      handleInputChange,
      inputToken?.balanceParsed,
      inputToken?.decimals,
    ],
  );
  const [, setInAppNotification] = useInAppNotificationAtom();
  const onInputFocus = useCallback(() => {
    setInAppNotification((v) => ({
      ...v,
      swapPercentageInputStageShowForNative: true,
    }));
  }, [setInAppNotification]);

  const onInputBlur = useCallback(() => {
    setInAppNotification((v) => ({
      ...v,
      swapPercentageInputStageShowForNative: false,
    }));
  }, [setInAppNotification]);

  useSwapLimitPriceCheck(inputToken, toToken);

  return (
    <YStack borderRadius="$2" bg="$bgStrong" mb="$2">
      <XStack borderTopLeftRadius="$2" borderTopRightRadius="$2">
        <Input
          size="small"
          containerProps={{
            flex: 1,
            borderWidth: 0,
            py: '$1',
          }}
          keyboardType="decimal-pad"
          value={
            swapProTradeType === ESwapProTradeType.MARKET
              ? swapProInputAmount
              : fromInputAmount.value
          }
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          onChangeText={handleInputChange}
          placeholder={intl.formatMessage({
            id: ETranslations.content__amount,
          })}
          addOns={[
            {
              renderContent: isLoading ? (
                <XStack alignItems="center" gap="$1" px="$2">
                  <Skeleton width="$10" height="$5" borderRadius="$full" />
                </XStack>
              ) : (
                <XStack
                  alignItems="center"
                  gap="$1"
                  px="$2"
                  {...(isTokenSelectorVisible && {
                    onPress: () => setIsPopoverOpen(true),
                    userSelect: 'none',
                    hoverStyle: { bg: '$bgHover' },
                    pressStyle: { bg: '$bgActive' },
                    borderCurve: 'continuous',
                  })}
                >
                  {inputToken?.logoURI ? (
                    <Image
                      src={inputToken.logoURI}
                      size="$4.5"
                      borderRadius="$full"
                    />
                  ) : null}
                  <SizableText size="$bodyMd" maxWidth="$16" numberOfLines={1}>
                    {inputToken?.symbol}
                  </SizableText>
                  {isTokenSelectorVisible ? (
                    <Icon
                      name="ChevronDownSmallOutline"
                      size="$4"
                      color="$iconSubdued"
                    />
                  ) : null}
                </XStack>
              ),
            },
          ]}
        />
        <TokenSelectorPopover
          currentSelectToken={swapProSelectToken}
          isOpen={isPopoverOpen}
          onOpenChange={setIsPopoverOpen}
          tokens={defaultTokensFromType as IToken[]}
          onTokenPress={handleTokenSelect}
          onTradePress={() => {
            setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
          }}
          disabledOnSwitchToTrade
        />
      </XStack>
      <Divider />
      <SwapProInputSegment
        items={inputSegmentItems}
        onSelect={onSelectInputSegment}
      />
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={SwapAmountInputAccessoryViewID}>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        </InputAccessoryView>
      ) : null}
      {!platformEnv.isNativeIOS ? (
        <Page.Footer>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        </Page.Footer>
      ) : null}
    </YStack>
  );
};

export default SwapProInputContainer;
