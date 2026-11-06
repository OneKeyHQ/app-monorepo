import {
  Fragment,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { ShimmerTitle } from '@onekeyhq/components/src/composite/DeviceStage/ShimmerTitle';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { POLLING_INTERVAL_FOR_HISTORY } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDistanceToNowStrict } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { buildHistoryActivityRow } from '../HomeHistoryListView/historyActivityRows';
import { HomeStickyHeaderContext } from '../HomeStickyHeaderContext';

import {
  WALLET_ACTIVITY_HINT_WINDOW_MS,
  getWalletActivityHintAmounts,
  getWalletActivityHintStatus,
  getWalletActivitySeenScopeKey,
  getWalletActivityTxTime,
  initWalletActivityHintTransition,
  selectWalletActivityHint,
  settleWalletActivityHintTransition,
  updateWalletActivityHintTransition,
  updateWalletActivitySeenMap,
} from './walletActivityHintUtils';

import type {
  IWalletActivityHint,
  IWalletActivitySeenMap,
} from './walletActivityHintUtils';

type IVaultDisplaySettings = Pick<
  Awaited<
    ReturnType<typeof backgroundApiProxy.serviceNetwork.getVaultSettings>
  >,
  'isUtxo' | 'localWallet'
>;

type IWalletActivityHintData = {
  scopeKey: string;
  txs: IAccountHistoryTx[];
  vaultByNetworkId: Record<string, IVaultDisplaySettings | undefined>;
};

// Re-read as soon as local history changes (a send is saved, a pending send
// settles), not only on the next poll.
const HISTORY_CHANGED_EVENTS = [
  EAppEventBusNames.HistoryTxStatusChanged,
  EAppEventBusNames.LocalPendingTxConfirmed,
  EAppEventBusNames.ClearLocalHistoryPendingTxs,
  EAppEventBusNames.RefreshHistoryList,
] as const;

// The web animation driver writes these names into `transition-property`.
// Reduced motion keeps the fades and drops the fold and the blur.
const ANIMATE_ONLY_BACKGROUND = ['background-color'];
const ANIMATE_ONLY_FOLD = ['height', 'opacity'];
const ANIMATE_ONLY_FADE = ['opacity'];
const ANIMATE_ONLY_SWAP = ['opacity', 'filter'];
// Lengths of the `switch` (200ms) and `popoverQuick` (150ms) presets.
const FOLD_ENTER_MS = 200;
const FOLD_EXIT_MS = 150;
const SWAP_MS = 150;
// The 8 gap to the balance row plus the 28 line, less the 4 of the hover
// plate that reaches into the space below: the text keeps the header's usual
// distance to the banner.
const SLOT_HEIGHT = 32;
const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
const WALLET_ACTIVITY_HINT_DEBOUNCE_MS = 150;

function readSeenMap(): IWalletActivitySeenMap {
  return (
    appStorage.syncStorage.getObject<IWalletActivitySeenMap>(
      EAppSyncStorageKeys.onekey_wallet_activity_seen_at,
    ) ?? {}
  );
}

function WalletActivityHintContent({ hint }: { hint: IWalletActivityHint }) {
  const { status, title, amounts, when } = hint;
  const failed = status === 'failed';
  return (
    <>
      {/* The History row's own words; the amount is the news, so it carries
          the weight. */}
      {title ? (
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={0}
        >
          {title}
        </SizableText>
      ) : null}
      {amounts.map((amount, index) => (
        <Fragment key={amount.key}>
          {/* Two amounts are a swap: what left, then what arrived. */}
          {index > 0 ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              →
            </SizableText>
          ) : null}
          <SizableText
            size="$bodyMdMedium"
            color={amount.tone === 'positive' ? '$textSuccess' : '$text'}
            numberOfLines={1}
            flexShrink={1}
            fontVariant={TABULAR_NUMS}
          >
            {amount.text}
          </SizableText>
        </Fragment>
      ))}
      <SizableText size="$bodyMd" color="$textSubdued">
        ·
      </SizableText>
      {/* The status sits after the dot in every state, so the line always
          starts with the amount: the time, a shimmering Pending (plain text
          under reduced motion), or the failure with its icon. */}
      {status === 'pending' ? (
        <ShimmerTitle size="$bodyMd" band="text">
          {when}
        </ShimmerTitle>
      ) : (
        <>
          {/* Text-sized (14), so it reads as part of the word. */}
          {failed ? (
            <Icon name="ErrorOutline" size="$3.5" color="$iconCritical" />
          ) : null}
          <SizableText
            size="$bodyMd"
            color={failed ? '$textCritical' : '$textSubdued'}
            numberOfLines={1}
            flexShrink={0}
            fontVariant={TABULAR_NUMS}
          >
            {when}
          </SizableText>
        </>
      )}
      <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
    </>
  );
}

type IWalletActivityHintViewProps = {
  // Nothing to report folds the line away.
  hint: IWalletActivityHint | undefined;
  // A new value lands the change that comes with it without motion.
  instantKey?: string;
  onPress: () => void;
};

// One job: confirm how the latest money movement went. Browsing the rest is
// the History tab's job, one press away right below.
function WalletActivityHintView({
  hint,
  instantKey,
  onPress,
}: IWalletActivityHintViewProps) {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState(() =>
    initWalletActivityHintTransition({ hint, instantKey }),
  );
  // Adjusted while rendering, so the outgoing words are still on screen in
  // the frame the new ones mount.
  const view = updateWalletActivityHintTransition(state, { hint, instantKey });
  if (view !== state) setState(view);
  const { drawn, leaving, phase } = view;

  useEffect(() => {
    if (phase !== 'entering' && phase !== 'exiting') return undefined;
    const timer = setTimeout(
      () => setState(settleWalletActivityHintTransition),
      phase === 'entering' ? FOLD_ENTER_MS : FOLD_EXIT_MS,
    );
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(
      () => setState((prev) => ({ ...prev, leaving: undefined })),
      SWAP_MS,
    );
    return () => clearTimeout(timer);
  }, [leaving]);

  const handleKeyDown = useCallback(
    (event: { key: string; preventDefault: () => void }) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPress();
      }
    },
    [onPress],
  );

  if (!drawn) return null;
  const open = phase !== 'exiting';
  // Clipped only while the height moves; at rest the hover plate and the
  // focus ring reach past the slot.
  const folding = !reduceMotion && phase !== 'shown';
  const blur = reduceMotion ? undefined : 'blur(2px)';
  const swapMotion = {
    transition: 'popoverQuick',
    animateOnly: reduceMotion ? ANIMATE_ONLY_FADE : ANIMATE_ONLY_SWAP,
  } as const;

  return (
    // Folds from nothing (its own gap included) so the tabs below glide
    // instead of jumping.
    <YStack
      h={open || reduceMotion ? SLOT_HEIGHT : 0}
      opacity={open ? 1 : 0}
      overflow={folding ? 'hidden' : 'visible'}
      pointerEvents={open ? 'auto' : 'none'}
      aria-hidden={open ? undefined : true}
      transition={open ? 'switch' : 'popoverQuick'}
      animateOnly={reduceMotion ? ANIMATE_ONLY_FADE : ANIMATE_ONLY_FOLD}
      {...(phase === 'entering' && {
        enterStyle: reduceMotion ? { opacity: 0 } : { h: 0, opacity: 0 },
      })}
    >
      <YStack pt="$2">
        {/* The previous event fades out on top while the new one fades in,
            so the line never goes blank between them. */}
        {leaving ? (
          <XStack
            key={`leaving-${leaving.key}`}
            position="absolute"
            top={8}
            left={0}
            right={16}
            h="$7"
            gap="$1"
            alignItems="center"
            pointerEvents="none"
            aria-hidden
            {...swapMotion}
            enterStyle={{
              opacity: 1,
              filter: reduceMotion ? undefined : 'blur(0px)',
            }}
            opacity={0}
            filter={blur}
          >
            <WalletActivityHintContent hint={leaving} />
          </XStack>
        ) : null}
        <XStack
          role="button"
          tabIndex={0}
          onPress={onPress}
          onKeyDown={handleKeyDown}
          position="relative"
          alignSelf="flex-start"
          maxWidth="100%"
          h="$7"
          px="$2"
          mx="$-2"
          alignItems="center"
          borderRadius="$2"
          userSelect="none"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          transition="100ms"
          animateOnly={ANIMATE_ONLY_BACKGROUND}
          focusVisibleStyle={{
            outlineColor: '$focusRing',
            outlineWidth: 2,
            outlineStyle: 'solid',
          }}
        >
          {/* 28 tall to the eye, 40 to the pointer. */}
          <Stack position="absolute" top={-6} bottom={-6} left={0} right={0} />
          <XStack
            key={drawn.key}
            flexShrink={1}
            minWidth={0}
            gap="$1"
            alignItems="center"
            {...(leaving && {
              ...swapMotion,
              enterStyle: { opacity: 0, filter: blur },
            })}
          >
            <WalletActivityHintContent hint={drawn} />
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

/**
 * Desktop wallet home: one line under the total that reports a pending send
 * or the latest activity the user has not seen yet; it disappears once they
 * have. Pressing it (or opening History) counts as seen.
 */
function useWalletActivityHintModel(): IWalletActivityHintViewProps {
  const intl = useIntl();
  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      deriveInfoItems,
      vaultSettings,
    },
  } = useActiveAccount({ num: 0 });
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const activeTabId = useContext(HomeStickyHeaderContext)?.activeTabId;
  const isHistoryTabActive = activeTabId === EHomeWalletTab.History;

  const isAllNetworks = !!network?.isAllNetworks;
  // Same owner as the History tab: BTC-like chains merge their derive paths.
  const mergeDerive =
    !isAllNetworks &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1 &&
    !!vaultSettings?.mergeDeriveAssetsEnabled;
  const ownerId = mergeDerive ? indexedAccount?.id : account?.id;
  const networkId = network?.id;
  const scopeKey =
    ownerId && networkId
      ? getWalletActivitySeenScopeKey({ ownerId, networkId })
      : undefined;

  const { result, run } = usePromiseResult<IWalletActivityHintData | undefined>(
    async () => {
      if (!ownerId || !networkId || !scopeKey) return undefined;
      const historyParams = {
        filterScam: settings.isFilterScamHistoryEnabled,
        filterLowValue: settings.isFilterLowValueHistoryEnabled,
        excludeTestNetwork: true,
        sourceCurrency: settings.currencyInfo.id,
        currencyMap,
      };
      let txs: IAccountHistoryTx[];
      if (isAllNetworks) {
        // The Spot tab's All Networks poll keeps local history current; a
        // second network fetch here would double that traffic.
        txs =
          await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
            accountId: ownerId,
            networkId,
            ...historyParams,
          });
      } else {
        // A single network has no other poller outside the History tab
        // (the side column that used to poll was removed from this layout).
        const response = mergeDerive
          ? await backgroundApiProxy.serviceHistory.fetchAccountHistoryForMergeDerive(
              { indexedAccountId: ownerId, networkId, ...historyParams },
            )
          : await backgroundApiProxy.serviceHistory.fetchAccountHistory({
              accountId: ownerId,
              networkId,
              ...historyParams,
            });
        txs = response.txs;
        // This fetch may be the one that notices a new transaction; refresh
        // those balances so the total moves together with the line.
        if (response.accountsWithChangedTxs.length > 0) {
          appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
            accounts: response.accountsWithChangedTxs,
          });
        }
      }
      const now = Date.now();
      const recentTxs = txs.filter(
        (tx) =>
          getWalletActivityHintStatus(tx) === 'pending' ||
          now - getWalletActivityTxTime(tx) <= WALLET_ACTIVITY_HINT_WINDOW_MS,
      );
      const networkIds = Array.from(
        new Set(recentTxs.map((tx) => tx.decodedTx.networkId)),
      );
      const vaults = await Promise.all(
        networkIds.map((id) =>
          backgroundApiProxy.serviceNetwork
            .getVaultSettings({ networkId: id })
            .then(
              (vault): IVaultDisplaySettings => ({
                isUtxo: vault.isUtxo,
                localWallet: vault.localWallet,
              }),
            )
            .catch(() => undefined),
        ),
      );
      return {
        scopeKey,
        txs: recentTxs,
        vaultByNetworkId: Object.fromEntries(
          networkIds.map((id, i) => [id, vaults[i]]),
        ),
      };
    },
    [
      ownerId,
      networkId,
      scopeKey,
      isAllNetworks,
      mergeDerive,
      settings.isFilterScamHistoryEnabled,
      settings.isFilterLowValueHistoryEnabled,
      settings.currencyInfo.id,
      currencyMap,
    ],
    {
      // The History tab polls the same data while it is open.
      overrideIsFocused: (isPageFocused) =>
        isPageFocused && !isHistoryTabActive,
      // Short enough that the line lands with the rest of the header instead
      // of pushing the page down a second later; still merges event bursts.
      debounced: WALLET_ACTIVITY_HINT_DEBOUNCE_MS,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
      revalidateOnFocus: true,
      // The home header is retained while the app is locked; its effects
      // reconnect on unlock and polling has to resume with them.
      resumeOnEffectReconnect: true,
    },
  );

  useEffect(() => {
    const handleHistoryChanged = () => {
      void run();
    };
    HISTORY_CHANGED_EVENTS.forEach((eventName) =>
      appEventBus.on(eventName, handleHistoryChanged),
    );
    return () => {
      HISTORY_CHANGED_EVENTS.forEach((eventName) =>
        appEventBus.off(eventName, handleHistoryChanged),
      );
    };
  }, [run]);

  const [seenMap, setSeenMap] = useState<IWalletActivitySeenMap>(readSeenMap);
  const seenMapRef = useRef(seenMap);
  const markSeen = useCallback((key: string) => {
    const next = updateWalletActivitySeenMap({
      seenMap: seenMapRef.current,
      scopeKey: key,
      seenAt: Date.now(),
    });
    seenMapRef.current = next;
    setSeenMap(next);
    void appStorage.syncStorage.setObject(
      EAppSyncStorageKeys.onekey_wallet_activity_seen_at,
      next,
    );
  }, []);

  // Opening History counts as seen, and so does whatever arrived while it
  // was open: mark again on the way out.
  useEffect(() => {
    if (!isHistoryTabActive || !scopeKey) return undefined;
    markSeen(scopeKey);
    return () => markSeen(scopeKey);
  }, [isHistoryTabActive, markSeen, scopeKey]);

  // Leaving History resumes the line; read the latest instead of waiting for
  // the next poll.
  const wasHistoryTabActiveRef = useRef(isHistoryTabActive);
  useEffect(() => {
    if (wasHistoryTabActiveRef.current && !isHistoryTabActive) void run();
    wasHistoryTabActiveRef.current = isHistoryTabActive;
  }, [isHistoryTabActive, run]);

  const handlePress = useCallback(() => {
    if (scopeKey) markSeen(scopeKey);
    appEventBus.emit(EAppEventBusNames.SwitchWalletHomeTab, {
      id: EHomeWalletTab.History,
    });
  }, [markSeen, scopeKey]);

  const ready = !!result && !!scopeKey && result.scopeKey === scopeKey;
  const seenAt = scopeKey ? seenMap[scopeKey] : undefined;
  // These changes come with a bigger one on screen, so the line follows
  // without motion: another account or network, its first answer, and
  // History opening (which marks the line seen).
  const instantKey = `${scopeKey ?? ''}|${ready ? 'ready' : 'loading'}|${
    seenAt ?? 0
  }`;
  const selection =
    ready && result
      ? selectWalletActivityHint({
          txs: result.txs,
          seenAt,
          now: Date.now(),
        })
      : undefined;
  if (!result || !selection) {
    return { hint: undefined, instantKey, onPress: handlePress };
  }

  const { lead, status } = selection;
  const vault = result.vaultByNetworkId[lead.decodedTx.networkId];
  // The History row's own wording and amounts, so both always agree.
  const { row, direction, labeledTitle } = buildHistoryActivityRow({
    history: lead,
    intl,
    tableLayout: false,
    isUTXO: vault?.isUtxo,
    localWallet: vault?.localWallet,
    hideValue: settingsValue.hideValue,
    currency: settings.currencyInfo.symbol,
    isAllNetworks,
  });
  let when = formatDistanceToNowStrict(getWalletActivityTxTime(lead), {
    addSuffix: true,
    roundingMethod: 'floor',
  });
  if (status === 'pending') {
    when = intl.formatMessage({ id: ETranslations.global_pending });
  } else if (status === 'failed') {
    when = intl.formatMessage({ id: ETranslations.global_failed });
  }

  const amounts = getWalletActivityHintAmounts({
    direction,
    primary: row.amounts.find((amount) => amount.key === 'primary'),
    secondary: row.amounts.find((amount) => amount.key === 'secondary'),
  });
  // A plain Send / Receive / Swap word only restates the amounts; a backend
  // label (Claim, Stake…) or an action without amounts still needs words.
  const showTitle = !!labeledTitle || amounts.length === 0;

  return {
    hint: {
      key: `${lead.id}|${status}`,
      status,
      title: showTitle
        ? row.title ||
          intl.formatMessage({
            id: ETranslations.transaction__contract_interaction,
          })
        : undefined,
      amounts,
      when,
    },
    instantKey,
    onPress: handlePress,
  };
}

function BaseWalletActivityHint() {
  const model = useWalletActivityHintModel();
  return <WalletActivityHintView {...model} />;
}

export const WalletActivityHint = memo(BaseWalletActivityHint);
