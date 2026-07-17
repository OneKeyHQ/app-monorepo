import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProSellToTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapProUseSelectBuyTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { TokenSelectorPopover } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenSelectorPopover';
import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

import type { IToken } from '../../../Market/MarketDetailV2/components/SwapPanel/types';

interface ISwapProPayTokenSelectorProps {
  defaultTokens: ISwapTokenBase[];
  defaultLimitTokens: ISwapTokenBase[];
  cleanInputAmount: () => void;
}

// Explicit "Pay" row (styled like the order-type selector) so the pay-token
// switch is discoverable at a glance; the Balance row keeps only display and
// the deposit entry. BUY only — SELL spends the traded token and picks its
// counterparty via SellForSelector.
const SwapProPayTokenSelector = ({
  defaultTokens,
  defaultLimitTokens,
  cleanInputAmount,
}: ISwapProPayTokenSelectorProps) => {
  const intl = useIntl();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProUseSelectBuyToken, setSwapProUseSelectBuyToken] =
    useSwapProUseSelectBuyTokenAtom();
  const [, setSwapProSellToToken] = useSwapProSellToTokenAtom();
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const defaultTokensFromType = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return defaultTokens;
    }
    return defaultLimitTokens;
  }, [swapProTradeType, defaultTokens, defaultLimitTokens]);

  // Stock tokens must be paid with stable coins; gray out the native coin.
  const disableNativePayToken = !!swapProSelectToken?.isStock;

  const handlePayTokenSelect = useCallback(
    (token: IToken) => {
      // Reset amount/slider and drop the in-flight quote before re-quoting
      // against the newly selected pay token.
      cleanInputAmount();
      setSwapProUseSelectBuyToken(token);
      // Sync SELL counterparty so both directions use the same token
      setSwapProSellToToken(token);
      setIsPopoverOpen(false);
      // Save preference (shared with Instant Mode) via simpledb
      const networkId = swapProSelectToken?.networkId || '';
      if (networkId) {
        void backgroundApiProxy.simpleDb.marketTokenPreference.setPreference({
          networkId,
          preference: {
            contractAddress: token.contractAddress,
            symbol: token.symbol,
            networkId: token.networkId,
          },
        });
      }
    },
    [
      cleanInputAmount,
      setSwapProUseSelectBuyToken,
      setSwapProSellToToken,
      swapProSelectToken?.networkId,
    ],
  );

  // Hidden on single-token networks (no switch entry per requirement).
  if (
    swapProDirection !== ESwapDirection.BUY ||
    defaultTokensFromType.length <= 1
  ) {
    return null;
  }

  return (
    <>
      <XStack
        testID="swap-pro-pay-token-selector"
        pl="$3"
        pr="$2"
        h="$8"
        borderRadius="$2"
        bg="$bgStrong"
        alignItems="center"
        gap="$2"
        userSelect="none"
        onPress={() => setIsPopoverOpen(true)}
        hoverStyle={{ bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
      >
        <SizableText
          flex={1}
          size="$bodyMd"
          textAlign="center"
          numberOfLines={1}
        >
          {`${intl.formatMessage({ id: ETranslations.global_pay })} (${
            swapProUseSelectBuyToken?.symbol ?? '-'
          })`}
        </SizableText>
        <Icon size="$4" name="ChevronDownSmallOutline" color="$iconSubdued" />
      </XStack>
      {/* The popover renders a zero-height trigger; absolute-position it so
          it does not consume the panel column gap as an invisible sibling. */}
      <Stack position="absolute">
        <TokenSelectorPopover
          currentSelectToken={swapProSelectToken}
          isOpen={isPopoverOpen}
          onOpenChange={setIsPopoverOpen}
          tokens={defaultTokensFromType as IToken[]}
          onTokenPress={handlePayTokenSelect}
          onTradePress={() => {
            setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
          }}
          disabledOnSwitchToTrade
          disableNativeToken={disableNativePayToken}
        />
      </Stack>
    </>
  );
};

export default SwapProPayTokenSelector;
