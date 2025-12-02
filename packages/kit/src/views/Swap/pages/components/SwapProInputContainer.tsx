import { useCallback, useMemo, useState } from 'react';

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
  useSwapProDirectionAtom,
  useSwapProInputAmountAtom,
  useSwapProUseSelectBuyTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TokenSelectorPopover } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenSelectorPopover';
import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { useSwapProInputToken } from '../../hooks/useSwapPro';

import type { IToken } from '../../../Market/MarketDetailV2/components/SwapPanel/types';

interface ISwapProInputContainerProps {
  defaultTokens: IToken[];
  isLoading?: boolean;
}

const SwapProInputContainer = ({
  defaultTokens,
  isLoading,
}: ISwapProInputContainerProps) => {
  const intl = useIntl();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const [, setSwapProUseSelectBuyToken] = useSwapProUseSelectBuyTokenAtom();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const inputToken = useSwapProInputToken();
  const handleInputChange = useCallback(
    (text: string) => {
      if (validateAmountInput(text, inputToken?.decimals)) {
        setSwapProInputAmount(text);
      }
    },
    [inputToken?.decimals, setSwapProInputAmount],
  );
  const handleTokenSelect = useCallback(
    (token: IToken) => {
      setSwapProUseSelectBuyToken(token);
    },
    [setSwapProUseSelectBuyToken],
  );
  const isTokenSelectorVisible =
    swapProDirection === ESwapDirection.BUY && defaultTokens.length > 1;

  return (
    <Stack borderRadius="$2" bg="$bgStrong" mb="$2">
      <Input
        size="medium"
        containerProps={{
          borderWidth: 0,
        }}
        keyboardType="decimal-pad"
        value={swapProInputAmount}
        onChangeText={handleInputChange}
        leftAddOnProps={{
          label: intl.formatMessage({ id: ETranslations.content__amount }),
        }}
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
        isOpen={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        tokens={defaultTokens}
        onTokenPress={handleTokenSelect}
      />
    </Stack>
  );
};

export default SwapProInputContainer;
