import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useSwapActions,
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProSellToTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapProUseSelectBuyTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { TokenSelectorPopover } from '../../../Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenSelectorPopover';
import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import {
  filterSwapProCounterpartyTokens,
  getSwapProDefaultTokens,
} from '../../utils/swapTypeUtils';

import type { IToken } from '../../../Market/MarketDetailV2/components/SwapPanel/types';

interface ISwapProPayTokenSelectorProps {
  defaultTokens: ISwapTokenBase[];
  defaultLimitTokens: ISwapTokenBase[];
  cleanInputAmount: () => void;
  configReady: boolean;
}

// Explicit counterparty-token row styled like the order-type selector, so the
// switch entry is discoverable at a glance and BUY/SELL share one interaction:
// BUY shows "Pay (USDC)" (the token being spent), SELL shows "Sell for (USDC)"
// (the token received). The Balance row keeps only display and the deposit
// entry.
const SwapProPayTokenSelector = ({
  defaultTokens,
  defaultLimitTokens,
  cleanInputAmount,
  configReady,
}: ISwapProPayTokenSelectorProps) => {
  const intl = useIntl();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProUseSelectBuyToken, setSwapProUseSelectBuyToken] =
    useSwapProUseSelectBuyTokenAtom();
  const [swapProSellToToken, setSwapProSellToToken] =
    useSwapProSellToTokenAtom();
  const { clearSwapTokenCarryIntent } = useSwapActions().current;
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const isBuy = swapProDirection === ESwapDirection.BUY;

  const defaultTokensFromType = useMemo(
    () =>
      getSwapProDefaultTokens({
        tradeType: swapProTradeType,
        defaultTokens,
        defaultLimitTokens,
      }),
    [swapProTradeType, defaultTokens, defaultLimitTokens],
  );

  // Stock tokens must trade against stable coins in BOTH directions. The
  // selectable set is the SAME shared filter the default init and preference
  // restore use (stable-coin whitelist for stock pairs), so the popover can
  // never offer a token those paths would reject; everything outside it
  // renders grayed out.
  const counterpartyTokens = useMemo(
    () =>
      filterSwapProCounterpartyTokens({
        tokens: defaultTokensFromType,
        isStockPair: !!swapProSelectToken?.isStock,
      }),
    [defaultTokensFromType, swapProSelectToken?.isStock],
  );
  const isTokenDisabled = useCallback(
    (token: IToken) =>
      !counterpartyTokens.some((candidate) =>
        equalTokenNoCaseSensitive({
          token1: candidate,
          token2: token,
        }),
      ),
    [counterpartyTokens],
  );

  const displayToken = isBuy ? swapProUseSelectBuyToken : swapProSellToToken;

  const handleTokenSelect = useCallback(
    (token: IToken) => {
      const savePreference = () => {
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
      };
      // Re-picking the already-selected token keeps the typed amount and the
      // current atom (which carries enriched balance fields the popover token
      // lacks), but still confirms the choice: persist the preference and pull
      // a diverged other-direction atom onto the same token.
      if (
        equalTokenNoCaseSensitive({
          token1: token,
          token2: displayToken,
        })
      ) {
        const otherDirectionToken = isBuy
          ? swapProSellToToken
          : swapProUseSelectBuyToken;
        if (
          !equalTokenNoCaseSensitive({
            token1: token,
            token2: otherDirectionToken,
          })
        ) {
          if (isBuy) {
            setSwapProSellToToken(token);
          } else {
            setSwapProUseSelectBuyToken(token);
          }
        }
        savePreference();
        setIsPopoverOpen(false);
        return;
      }
      if (isBuy) {
        // The BUY amount is denominated in the pay token, so reset it (and
        // the in-flight quote) before re-quoting against the new token.
        cleanInputAmount();
      }
      // Keep both directions on the same token so switching sides is stable.
      setSwapProUseSelectBuyToken(token);
      setSwapProSellToToken(token);
      setIsPopoverOpen(false);
      savePreference();
    },
    [
      isBuy,
      displayToken,
      swapProSellToToken,
      swapProUseSelectBuyToken,
      cleanInputAmount,
      setSwapProUseSelectBuyToken,
      setSwapProSellToToken,
      swapProSelectToken?.networkId,
    ],
  );

  const hasSelectableTokens = defaultTokensFromType.length > 1;

  // Keep the real row mounted while config is resolving so the panel geometry
  // does not change when the counterparty list arrives. Once resolved,
  // single-token networks still hide the switch entry per requirement.
  if (configReady && !hasSelectableTokens) {
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
        onPress={hasSelectableTokens ? () => setIsPopoverOpen(true) : undefined}
        hoverStyle={{ bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
      >
        <SizableText
          flex={1}
          size="$bodyMd"
          textAlign="center"
          numberOfLines={1}
        >
          {`${intl.formatMessage({
            id: isBuy
              ? ETranslations.global_pay
              : ETranslations.promode_limit_sell_for,
          })} (${displayToken?.symbol ?? '-'})`}
        </SizableText>
        <Icon size="$4" name="ChevronDownSmallOutline" color="$iconSubdued" />
      </XStack>
      {/* The popover renders a zero-height trigger; absolute-position it so
          it does not consume the panel column gap as an invisible sibling. */}
      {hasSelectableTokens ? (
        <Stack position="absolute">
          <TokenSelectorPopover
            currentSelectToken={swapProSelectToken}
            isOpen={isPopoverOpen}
            onOpenChange={setIsPopoverOpen}
            tokens={defaultTokensFromType as IToken[]}
            onTokenPress={handleTokenSelect}
            onTradePress={() => {
              clearSwapTokenCarryIntent();
              setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
            }}
            disabledOnSwitchToTrade
            isTokenDisabled={isTokenDisabled}
            // Keep the server-config order (native coin first, then stable
            // coins) so the list doesn't reshuffle once balances load in.
            sortTokensByValue={false}
          />
        </Stack>
      ) : null}
    </>
  );
};

export default SwapProPayTokenSelector;
