import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  Input,
  SizableText,
  Skeleton,
  Stack,
  XStack,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { TokenSelectorPopover } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenSelectorPopover';
import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import {
  useSwapLimitPriceCheck,
  useSwapProInputToken,
  useSwapProToToken,
} from '../../hooks/useSwapPro';

import type { IToken } from '../../../Market/MarketDetailV2/components/SwapPanel/types';

interface ISwapProInputContainerProps {
  defaultTokens: IToken[];
  isLoading?: boolean;
  cleanInputAmount: () => void;
}

const SwapProInputContainer = ({
  defaultTokens,
  isLoading,
  cleanInputAmount,
}: ISwapProInputContainerProps) => {
  const intl = useIntl();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const [, setSwapProUseSelectBuyToken] = useSwapProUseSelectBuyTokenAtom();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
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
    swapProDirection === ESwapDirection.BUY && defaultTokens.length > 1;

  useSwapLimitPriceCheck(inputToken, toToken);

  return (
    <Stack borderRadius="$2" bg="$bgStrong" mb="$2">
      <Input
        size="medium"
        containerProps={{
          borderWidth: 0,
        }}
        keyboardType="decimal-pad"
        value={
          swapProTradeType === ESwapProTradeType.MARKET
            ? swapProInputAmount
            : fromInputAmount.value
        }
        onChangeText={handleInputChange}
        placeholder={intl.formatMessage({ id: ETranslations.content__amount })}
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
                    width="$5"
                    height="$5"
                    borderRadius="$full"
                  />
                ) : null}
                <SizableText size="$bodyLg">{inputToken?.symbol}</SizableText>
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
        tokens={defaultTokens}
        onTokenPress={handleTokenSelect}
        onTradePress={() => {
          setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
        }}
        disabledOnSwitchToTrade
      />
    </Stack>
  );
};

export default SwapProInputContainer;
