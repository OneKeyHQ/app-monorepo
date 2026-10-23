import type { Dispatch, RefObject, SetStateAction } from 'react';
import { createContext, useCallback, useEffect, useMemo, useRef } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import {
  Accordion,
  Divider,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IElement, IYStackProps } from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useEarnAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';

import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { useEarnDesktopWalletHoldings } from '../../components/desktopHome/useEarnDesktopHomeData';

import { listPayTokens, pickDefaultPayToken } from './earnRouter.utils';
import { useEscapeFoldsList } from './useEscapeFoldsList';

import type { IEarnRouterPayToken } from './earnRouter.utils';

// The wallet's tokens on the deposit's network, for Pay with
export function usePayTokens({
  networkId,
  depositSymbol,
  enabled = true,
}: {
  networkId: string;
  depositSymbol: string;
  enabled?: boolean;
}) {
  const refreshNetworkIds = useMemo(() => [networkId], [networkId]);
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const payableSymbols = useMemo(
    () =>
      new Set(
        Object.values(availableAssetsByType).flatMap((assets) =>
          (assets ?? []).map((asset) => asset.symbol.toLowerCase()),
        ),
      ),
    [availableAssetsByType],
  );
  const wallet = useEarnDesktopWalletHoldings({
    isActive: enabled,
    refreshNetworkIds,
  });
  const group = useMemo(
    () => wallet.networkGroups.find((item) => item.networkId === networkId),
    [networkId, wallet.networkGroups],
  );
  const tokens = useMemo(
    () =>
      listPayTokens({
        group,
        depositSymbol,
        // Before Earn's lists are in, nothing is filtered out
        payableSymbols: payableSymbols.size ? payableSymbols : undefined,
      }),
    [depositSymbol, group, payableSymbols],
  );
  const defaultToken = useMemo(() => pickDefaultPayToken(tokens), [tokens]);
  return {
    tokens,
    defaultToken,
    isLoaded: wallet.isLoaded,
    refresh: wallet.refresh,
  };
}

// A row of a list unfolding in place (Pay with's tokens, the protocol list)
// comes in faded and 4 px up, each a moment after the one above
export const LIST_ROW_STAGGER_MS = 20;
export const LIST_ROW_ENTER_STYLE = { opacity: 0, y: -4 } as const;
// The lists open over 250 ms and fold over 200 ms on the app's smooth curve
export const LIST_FOLD_MS = 200;
// A pick is applied once the fold is done and a moment has passed, so the
// modal tells the new form from the fold and eases to its height
export const LIST_PICK_APPLY_MS = LIST_FOLD_MS + 40;
// Reduced motion: the list opens and folds at once, its rows show as it does
export const getListHeightTransition = (
  isOpen: boolean,
  reduceMotion?: boolean,
) =>
  reduceMotion
    ? undefined
    : (['smooth', { duration: isOpen ? 250 : LIST_FOLD_MS }] as [
        'smooth',
        { duration: number },
      ]);
export const getListRowMotion = (
  index: number,
  reduceMotion?: boolean,
): Pick<IYStackProps, 'transition' | 'animateOnly' | 'enterStyle'> =>
  reduceMotion
    ? {}
    : {
        // The web driver takes a delay for the whole transition only
        transition: ['fast', { delay: index * LIST_ROW_STAGGER_MS }],
        animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
        enterStyle: LIST_ROW_ENTER_STYLE,
      };

// A token in the amount box's list: the same row look as the protocol list
// under it, inset so its hover reads as one item of the box
function PayTokenRow({
  item,
  index,
  onSelect,
  focusRef,
}: {
  item: IEarnRouterPayToken;
  // Its place in the list: each row comes in a moment after the one above
  index: number;
  onSelect: (item: IEarnRouterPayToken) => void;
  // Set for the first row when the list opens from the keyboard
  focusRef?: RefObject<boolean>;
}) {
  const reduceMotion = useReducedMotion();
  const handlePress = useCallback(() => onSelect(item), [item, onSelect]);
  const rowRef = useRef<IElement>(null);
  useEffect(() => {
    if (focusRef?.current) {
      focusRef.current = false;
      rowRef.current?.focus();
    }
  }, [focusRef]);
  return (
    <XStack
      ref={rowRef}
      testID={`earn-router-pay-with-${item.token.symbol}`}
      role="button"
      ai="center"
      gap="$3"
      mx="$1.5"
      px="$2"
      py="$2"
      borderRadius="$2"
      borderCurve="continuous"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      cursor="pointer"
      userSelect="none"
      {...getListRowMotion(index, reduceMotion)}
      onPress={handlePress}
      {...buildKeyboardPressProps(handlePress)}
    >
      <Token size="md" tokenImageUri={item.token.logoURI} />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {item.token.symbol}
        </SizableText>
        {/* A name that only repeats the symbol (sUSD3, USDe) says nothing */}
        {item.token.name &&
        item.token.name.toLowerCase() !== item.token.symbol.toLowerCase() ? (
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {item.token.name}
          </SizableText>
        ) : null}
      </YStack>
      <YStack ai="flex-end" gap="$0.5" flexShrink={0}>
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyLgMedium"
          formatter="balance"
        >
          {item.amount}
        </NumberSizeableTextWrapper>
        <Currency
          hideValue
          size="$bodySm"
          color="$textSubdued"
          formatter="value"
          sourceCurrency={USD_CURRENCY_ID}
        >
          {item.fiatValueUsd}
        </Currency>
      </YStack>
    </XStack>
  );
}

// The deposit form's choices, Pay with's token list and the protocol list:
// one open at a time, so opening one folds the other
export type IEarnFormChoice = 'protocol' | 'payWith';
export const EarnFormChoiceContext = createContext<{
  open?: IEarnFormChoice;
  setOpen: Dispatch<SetStateAction<IEarnFormChoice | undefined>>;
} | null>(null);

// Shared with the token chip, so Escape in the list gives the focus back to it
export const PAY_WITH_TRIGGER_TEST_ID = 'earn-pay-with-trigger';
export const PAY_WITH_BOX_TEST_ID = 'earn-pay-with-box';

const PAY_LIST_VALUE = 'pay-with';
const PAY_LIST_HIDDEN_STYLE = { opacity: 0 } as const;
// About four and a half rows; a longer wallet scrolls inside the box
const PAY_LIST_MAX_HEIGHT = 280;

/**
 * Pay with's choices, unfolding inside the amount box under its balance
 * line: the other tokens the wallet holds on the network, the deposit token
 * first. A pick folds the list; the caller applies it once folded
 */
export function EarnPayWithList({
  tokens,
  isOpen,
  onPick,
  onClose,
  focusFirstRef,
}: {
  tokens: IEarnRouterPayToken[];
  isOpen: boolean;
  onPick: (item: IEarnRouterPayToken) => void;
  onClose: () => void;
  focusFirstRef?: RefObject<boolean>;
}) {
  const reduceMotion = useReducedMotion();
  // Escape folds the list; from inside it, the focus goes back to the token
  // chip. From the amount box the cursor stays where it is
  const listRef = useRef<IElement>(null);
  const handleEscape = useCallback(
    (wasFocusInList: boolean) => {
      onClose();
      const list = listRef.current as unknown;
      if (
        wasFocusInList &&
        typeof HTMLElement !== 'undefined' &&
        list instanceof HTMLElement
      ) {
        list
          .closest(`[data-testid="${PAY_WITH_BOX_TEST_ID}"]`)
          ?.querySelector<HTMLElement>(
            `[data-testid="${PAY_WITH_TRIGGER_TEST_ID}"]`,
          )
          ?.focus();
      }
    },
    [onClose],
  );
  useEscapeFoldsList(isOpen, handleEscape, listRef);
  return (
    <Accordion type="single" collapsible value={isOpen ? PAY_LIST_VALUE : ''}>
      <Accordion.Item value={PAY_LIST_VALUE}>
        <Accordion.HeightAnimator
          transition={getListHeightTransition(isOpen, reduceMotion)}
        >
          {/* The rows come in themselves; the list fades out as it folds */}
          <Accordion.Content
            unstyled
            transition="quick"
            animateOnly={ANIMATE_ONLY_OPACITY}
            exitStyle={PAY_LIST_HIDDEN_STYLE}
          >
            <YStack ref={listRef}>
              <Divider mx="$3.5" />
              <ScrollView maxHeight={PAY_LIST_MAX_HEIGHT}>
                <YStack py="$1.5" gap="$0.5">
                  {tokens.map((item, index) => (
                    <PayTokenRow
                      key={item.key}
                      item={item}
                      index={index}
                      onSelect={onPick}
                      focusRef={index === 0 ? focusFirstRef : undefined}
                    />
                  ))}
                </YStack>
              </ScrollView>
            </YStack>
          </Accordion.Content>
        </Accordion.HeightAnimator>
      </Accordion.Item>
    </Accordion>
  );
}
