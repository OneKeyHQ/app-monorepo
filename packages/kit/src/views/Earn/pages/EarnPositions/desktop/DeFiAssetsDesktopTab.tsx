import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import { Empty, Spinner, Stack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { EarnTestIDs } from '../../../testIDs';
import { GroupRow, useGroupExpansion } from '../mobile/GroupRow';
import { useRepeatedProtocolNetworkNames } from '../mobile/useRepeatedProtocolNetworkNames';

import { EarnPortfolioOverview } from './EarnPortfolioOverview';
import { EarnPositionDesktopBlock } from './EarnPositionDesktopBlock';

import type { IEarnPositionCardHandlers } from '../mobile/EarnPositionCard';
import type { IEarnProtocolView } from '../mobile/earnPositionModel';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
// The gap between the cards ($4)
const CARD_SCROLL_MARGIN_TOP = 16;
// The scroll to a card counts as done once the card has held still this
// many frames where the scroll was taking it. Time alone can't tell: a long
// first render holds the smooth scroll back past any short wait
const SETTLE_FRAMES = 4;
// A scroll that never gets there (the page reflowed under it) flashes anyway
const SETTLE_TIMEOUT_MS = 2000;
// The card's header lights up a step for about 600 ms in all: 150 ms in,
// held, 150 ms back
const HEADER_FLASH_MS = 450;
// A request from the home's split waits this long for its cards to load
const FOCUS_REQUEST_TTL_MS = 10_000;

const NO_KEYS: ReadonlySet<string> = new Set();

function findScrollParent(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

// The card's top at the page's top, its gap above it; or as near as the page
// goes, the last cards stopping short with the page at its end
function isAtScrollTarget(node: HTMLElement, scroller: HTMLElement) {
  const offset =
    node.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top -
    CARD_SCROLL_MARGIN_TOP;
  if (Math.abs(offset) < 2) {
    return true;
  }
  if (offset > 0) {
    return (
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
    );
  }
  return scroller.scrollTop <= 0;
}

/**
 * DeFi Assets in the wide layout, the way the wallet DeFi Portfolio reads on
 * desktop: the allocation overview, then one open card per protocol per
 * network, its holdings as tables. A tile opens its card and scrolls the
 * page to it. The phone tab's empty and loading states.
 */
function BasicDeFiAssetsDesktopTab({
  focusRequest,
  protocols,
  deFiProtocols,
  protocolMap,
  isLoading,
  pendingCountByProvider,
  onManage,
  onRedeem,
  onWarmRedeem,
}: {
  /** A share of the home's split: its protocols' cards, once they are in */
  focusRequest?: { protocols: string[]; at: number };
  protocols: IEarnProtocolView[];
  deFiProtocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  isLoading: boolean;
  pendingCountByProvider: Record<string, number>;
} & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const expansion = useGroupExpansion();
  const { open } = expansion;
  const reduceMotion = useReducedMotion();
  const networkNames = useRepeatedProtocolNetworkNames(protocols);
  const anchorsRef = useRef(new Map<string, HTMLElement>());
  // The cards a tile or a share scrolled to, marked once the page stops
  const [flashKeys, setFlashKeys] = useState<ReadonlySet<string>>(NO_KEYS);
  const flashCleanupRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => flashCleanupRef.current?.(), []);
  const flashWhenSettled = useCallback((keys: string[], node: HTMLElement) => {
    flashCleanupRef.current?.();
    setFlashKeys(NO_KEYS);
    const scroller = findScrollParent(node);
    const startedAt = Date.now();
    let lastTop = Number.NaN;
    let stillFrames = 0;
    let frame: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watch = () => {
      const top = node.getBoundingClientRect().top;
      stillFrames = Math.abs(top - lastTop) < 0.5 ? stillFrames + 1 : 0;
      lastTop = top;
      const isThere = !scroller || isAtScrollTarget(node, scroller);
      if (
        (isThere && stillFrames >= SETTLE_FRAMES) ||
        Date.now() - startedAt > SETTLE_TIMEOUT_MS
      ) {
        frame = undefined;
        setFlashKeys(new Set(keys));
        timer = setTimeout(() => setFlashKeys(NO_KEYS), HEADER_FLASH_MS);
        return;
      }
      frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    flashCleanupRef.current = () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      clearTimeout(timer);
    };
  }, []);
  const positionsLabel = intl.formatMessage({
    id: ETranslations.earn_positions,
  });
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });

  const registerAnchor = useCallback(
    (key: string, node: HTMLElement | null) => {
      if (node) {
        anchorsRef.current.set(key, node);
      } else {
        anchorsRef.current.delete(key);
      }
    },
    [],
  );
  // Opens the cards and scrolls the page to the first, as the wallet's tiles
  // do, leaving the cards' gap above it. Where the page can't bring it to
  // the top (the last cards), the headers' flash still shows which they are
  const scrollToCards = useCallback(
    (keys: string[]) => {
      const node = keys.length ? anchorsRef.current.get(keys[0]) : undefined;
      if (!node || typeof node.scrollIntoView !== 'function') {
        return false;
      }
      keys.forEach((key) => open(key));
      node.style.scrollMarginTop = `${CARD_SCROLL_MARGIN_TOP}px`;
      node.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      // Focus goes to the card, so Tab goes on from there (its header next)
      // and not from what was pressed: the home's split stays under this
      // page. The card takes it without a ring; the header's flash marks it
      node.tabIndex = -1;
      node.style.outline = 'none';
      node.focus({ preventScroll: true });
      flashWhenSettled(keys, node);
      return true;
    },
    [open, flashWhenSettled, reduceMotion],
  );
  const handlePressProtocol = useCallback(
    (protocol: IDeFiProtocol) => {
      scrollToCards([
        defiUtils.buildProtocolMapKey({
          protocol: protocol.protocol,
          networkId: protocol.networkId,
        }),
      ]);
    },
    [scrollToCards],
  );
  // A share of the split is a protocol across networks, "N more" several:
  // all their cards, the page scrolled to the first of them
  const handleOpenSplitProtocols = useCallback(
    (protocolKeys: string[]) =>
      scrollToCards(
        protocols
          .filter((protocol) =>
            protocolKeys.includes(protocol.protocol.toLowerCase()),
          )
          .map((protocol) => protocol.key),
      ),
    [protocols, scrollToCards],
  );
  // The home's split asked for a protocol: done once its cards are in, or
  // dropped if they don't come
  const doneFocusAtRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      !focusRequest ||
      doneFocusAtRef.current === focusRequest.at ||
      Date.now() - focusRequest.at > FOCUS_REQUEST_TTL_MS
    ) {
      return;
    }
    if (handleOpenSplitProtocols(focusRequest.protocols)) {
      doneFocusAtRef.current = focusRequest.at;
    }
  }, [focusRequest, handleOpenSplitProtocols]);

  let placeholder: React.ReactNode = null;
  if (protocols.length === 0) {
    placeholder = isLoading ? (
      <Stack ai="center" py="$8">
        <Spinner size="large" />
      </Stack>
    ) : (
      <Empty
        illustration="BlockPercentage"
        title={intl.formatMessage({
          id: ETranslations.earn_no_assets_deposited,
        })}
      />
    );
  }

  return (
    <YStack gap="$8" pb="$4">
      <EarnPortfolioOverview
        protocols={protocols}
        deFiProtocols={deFiProtocols}
        protocolMap={protocolMap}
        onPressProtocol={handlePressProtocol}
        onOpenSplitProtocols={handleOpenSplitProtocols}
      />
      {placeholder}
      {protocols.length > 0 ? (
        <YStack gap="$4">
          {protocols.map((protocol) => (
            <GroupRow
              key={protocol.key}
              name={protocol.name}
              logoURI={protocol.logoURI}
              networkId={protocol.networkId}
              networkName={networkNames.get(protocol.key)}
              subtitle={`${protocol.positions.length} ${positionsLabel}`}
              pendingCount={pendingCountByProvider[protocol.protocol] ?? 0}
              expanded={expansion.isExpanded(protocol.key)}
              onToggle={() => expansion.toggle(protocol.key)}
              anchorRef={(node) => registerAnchor(protocol.key, node)}
              isHighlighted={flashKeys.has(protocol.key)}
              testID={EarnTestIDs.portfolioItem(protocol.name)}
              total={
                <ProtocolValueCell
                  value={protocol.value.value}
                  currencySymbol={currencyInfo.symbol}
                  priceUnavailableLabel={priceUnavailableLabel}
                  isUnavailable={!protocol.value.hasAvailableValue}
                  size="$headingLg"
                  textAlign="right"
                  numberOfLines={1}
                  fontVariant={TABULAR_NUMS}
                />
              }
            >
              {protocol.positions.map((position) => (
                <EarnPositionDesktopBlock
                  key={position.key}
                  position={position}
                  onManage={onManage}
                  onRedeem={onRedeem}
                  onWarmRedeem={onWarmRedeem}
                />
              ))}
            </GroupRow>
          ))}
        </YStack>
      ) : null}
      {/* scopes still landing behind the cards already shown */}
      {isLoading && protocols.length > 0 ? (
        <Stack ai="center" py="$4">
          <Spinner size="small" />
        </Stack>
      ) : null}
    </YStack>
  );
}

// Kept mounted while hidden on web; re-renders only when its own data changes
export const DeFiAssetsDesktopTab = memo(BasicDeFiAssetsDesktopTab);
