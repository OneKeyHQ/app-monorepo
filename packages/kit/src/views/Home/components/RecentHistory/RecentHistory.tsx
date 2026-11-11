import { memo, useCallback, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { uniq } from 'lodash';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { ShimmerTitle } from '@onekeyhq/components/src/composite/DeviceStage/ShimmerTitle';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { plainNativeSelectorText } from '@onekeyhq/kit/src/components/TokenListView/nativeSelectorFormat';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDistanceToNowStrict } from '@onekeyhq/shared/src/utils/dateUtils';
import { getHistoryTxDisplayStatus } from '@onekeyhq/shared/src/utils/historyUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { TxHistoryListContainer } from '../../pages/TxHistoryContainer';
import { buildHistoryActivityRow } from '../HomeHistoryListView/historyActivityRows';
import { RichBlock } from '../RichBlock';

import type { ITxHistoryCompactListProps } from '../../pages/TxHistoryContainer';
import type { ValueTextSegment } from '@onekeyfe/react-native-native-list';

function RecentHistoryTitle() {
  const intl = useIntl();
  const handleNavigateToHistory = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.SwitchWalletHomeTab, {
      id: EHomeWalletTab.History,
    });
  }, []);

  return (
    // A light plate on hover, like the page's other quiet controls; the
    // negative margin keeps the title where it was.
    <XStack
      alignItems="center"
      gap="$1"
      onPress={handleNavigateToHistory}
      cursor="default"
      px="$2"
      py="$1"
      mx="$-2"
      my="$-1"
      borderRadius="$2"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
    >
      <SizableText size="$headingXl" color="$text">
        {intl.formatMessage({
          id: ETranslations.wallet_recent_transaction_history_title,
        })}
      </SizableText>
      <Icon name="ChevronRightOutline" color="$iconSubdued" size="$5" />
    </XStack>
  );
}

type IRecentActivityRow = {
  history: IAccountHistoryTx;
  title: string;
  amount?: {
    text: string;
    // A tiny amount keeps its leading-zero count as a subscript segment.
    segments?: readonly ValueTextSegment[];
    positive: boolean;
  };
  status: 'pending' | 'failed' | 'done';
  when: string;
  tokenUri?: string;
  // First letter of the token's symbol, shown when it has no usable logo.
  tokenLetter?: string;
  // What a visual without a logo or letter shows, e.g. a contract call's
  // document icon, as in the History tab.
  fallbackIcon?: IKeyOfIcons;
  networkUri?: string;
  iconName?: IKeyOfIcons;
};

function readLeadingVisual(
  visual: unknown,
): Pick<
  IRecentActivityRow,
  'tokenUri' | 'tokenLetter' | 'fallbackIcon' | 'networkUri' | 'iconName'
> {
  if (!visual || typeof visual !== 'object') {
    return {};
  }
  const v = visual as {
    kind?: string;
    name?: string;
    image?: { uri?: string };
    networkImage?: { uri?: string };
    fallbackText?: string;
    fallbackIcon?: { name?: string };
  };
  if (v.kind === 'icon' && v.name) {
    return { iconName: v.name as IKeyOfIcons };
  }
  return {
    tokenUri: v.image?.uri,
    tokenLetter: v.fallbackText,
    fallbackIcon: v.fallbackIcon?.name as IKeyOfIcons | undefined,
    networkUri: v.networkImage?.uri,
  };
}

// UTXO and local-wallet flags change how a row is worded, as in the History
// tab. Custom networks without a logo get no badge here.
function useVaultDisplaySettings(data: IAccountHistoryTx[]) {
  const networkIdsKey = useMemo(
    () =>
      uniq(data.map((history) => history.decodedTx.networkId))
        .toSorted()
        .join(','),
    [data],
  );
  const { result } = usePromiseResult(async () => {
    const networkIds = networkIdsKey ? networkIdsKey.split(',') : [];
    const vaults = await Promise.all(
      networkIds.map((networkId) =>
        backgroundApiProxy.serviceNetwork
          .getVaultSettings({ networkId })
          .then((vault) => ({
            isUtxo: vault.isUtxo,
            localWallet: vault.localWallet,
          }))
          .catch(() => undefined),
      ),
    );
    return Object.fromEntries(
      networkIds.map((networkId, index) => [networkId, vaults[index]]),
    );
  }, [networkIdsKey]);
  return result;
}

function RecentActivityWhen({ row }: { row: IRecentActivityRow }) {
  if (row.status === 'pending') {
    return (
      <ShimmerTitle size="$bodyMd" band="text">
        {row.when}
      </ShimmerTitle>
    );
  }
  if (row.status === 'failed') {
    return (
      <XStack alignItems="center" gap="$1" minWidth={0}>
        <Icon name="ErrorOutline" size="$3.5" color="$iconCritical" />
        <SizableText size="$bodyMd" color="$textCritical" numberOfLines={1}>
          {row.when}
        </SizableText>
      </XStack>
    );
  }
  return (
    <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
      {row.when}
    </SizableText>
  );
}

// A row without a token (a contract call, say) draws its icon in the History
// table's colors, scaled to this column's smaller circle: a 20px icon in 32,
// as 24 in 40 there.
const ACTION_ICON_FRAME = {
  bg: '$gray2',
  borderWidth: '$px',
  borderColor: '$gray3',
} as const;

function RecentActivityIcon({ row }: { row: IRecentActivityRow }) {
  if (row.iconName && !row.tokenUri) {
    return (
      <Stack
        w="$8"
        h="$8"
        borderRadius="$full"
        {...ACTION_ICON_FRAME}
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Icon name={row.iconName} size="$5" color="$icon" />
      </Stack>
    );
  }
  // The coin is a token's own fallback, where its letter shows instead.
  const actionIcon =
    row.fallbackIcon && row.fallbackIcon !== 'CryptoCoinOutline'
      ? row.fallbackIcon
      : undefined;
  return (
    <Token
      size="md"
      tokenImageUri={row.tokenUri}
      networkImageUri={row.networkUri}
      symbol={row.tokenLetter}
      {...(actionIcon
        ? {
            ...ACTION_ICON_FRAME,
            fallback: <Icon name={actionIcon} size="$5" color="$icon" />,
          }
        : undefined)}
    />
  );
}

// A transaction that arrives while the column is on screen fades in, and a
// row's status line fades in when it settles (Confirming → time, or Failed).
// Rows that shift down move instantly; hover and press stay instant too.
const ROW_ANIMATE_ONLY = ['opacity', 'transform'];
const STATUS_ANIMATE_ONLY = ['opacity'];
const ROW_ENTER_STYLE = { opacity: 0, y: -8 };
const ROW_ENTER_STYLE_REDUCED = { opacity: 0 };
const STATUS_ENTER_STYLE = { opacity: 0 };

function RecentActivityItem({
  row,
  entering,
  onPressHistory,
}: {
  row: IRecentActivityRow;
  entering: boolean;
  onPressHistory: (history: IAccountHistoryTx) => void;
}) {
  const reduceMotion = useReducedMotion();
  // The status the row first showed; only a later change animates.
  const [initialStatus] = useState(row.status);
  const animateStatus = !reduceMotion && row.status !== initialStatus;
  const handlePress = useCallback(() => {
    onPressHistory(row.history);
  }, [onPressHistory, row.history]);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handlePress();
      }
    },
    [handlePress],
  );
  return (
    <XStack
      role="button"
      tabIndex={0}
      h={60}
      // Same plate as the token rows: 8 from the column edge, 12 inside.
      mx="$2"
      px="$3"
      gap="$3"
      alignItems="center"
      borderRadius="$3"
      userSelect="none"
      cursor="default"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: -2,
      }}
      aria-label={[
        row.title,
        row.when,
        row.amount ? plainNativeSelectorText(row.amount) : undefined,
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={handlePress}
      onKeyDown={handleKeyDown}
      transition="popoverQuick"
      animateOnly={ROW_ANIMATE_ONLY}
      {...(entering
        ? {
            enterStyle: reduceMotion
              ? ROW_ENTER_STYLE_REDUCED
              : ROW_ENTER_STYLE,
          }
        : undefined)}
    >
      <RecentActivityIcon row={row} />
      {/* With an amount, the action keeps up to half the row and the amount
          takes the rest, so a long amount truncates first. */}
      <YStack
        minWidth={0}
        {...(row.amount ? { flexShrink: 0, maxWidth: '50%' } : { flex: 1 })}
      >
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {row.title}
        </SizableText>
        <Stack
          key={row.status}
          transition="popoverQuick"
          animateOnly={STATUS_ANIMATE_ONLY}
          {...(animateStatus ? { enterStyle: STATUS_ENTER_STYLE } : undefined)}
        >
          <RecentActivityWhen row={row} />
        </Stack>
      </YStack>
      {row.amount ? (
        <SizableText
          size="$bodyLgMedium"
          color={row.amount.positive ? '$textSuccess' : '$text'}
          numberOfLines={1}
          flex={1}
          minWidth={0}
          textAlign="right"
        >
          {row.amount.segments
            ? row.amount.segments.map((segment, index) =>
                segment.style === 'subscript' ? (
                  // The zero count, at the 60% NumberSizeableText draws.
                  <SizableText
                    key={index}
                    size="$bodyLgMedium"
                    fontSize={10}
                    lineHeight={16}
                    color={row.amount?.positive ? '$textSuccess' : '$text'}
                  >
                    {segment.text}
                  </SizableText>
                ) : (
                  segment.text
                ),
              )
            : row.amount.text}
        </SizableText>
      ) : null}
    </XStack>
  );
}

const NO_ENTERING_IDS: ReadonlySet<string> = new Set();

// Ids that were not in the previous rows of the same account and network.
// The first rows of a scope (mount, account or network switch) paint as is.
function useEnteringIds(data: IAccountHistoryTx[], scopeKey: string) {
  // Compared by ids, not array identity, so a fresh array with the same rows
  // never re-adjusts the state.
  const ids = data.map((history) => history.id);
  const idsKey = ids.join('\n');
  const [previous, setPrevious] = useState({ idsKey, scopeKey });
  const [entering, setEntering] = useState(NO_ENTERING_IDS);
  if (previous.idsKey !== idsKey || previous.scopeKey !== scopeKey) {
    let next = NO_ENTERING_IDS;
    if (previous.scopeKey === scopeKey) {
      const previousIds = new Set(previous.idsKey.split('\n'));
      const added = ids.filter((id) => !previousIds.has(id));
      if (added.length) {
        next = new Set(added);
      }
    }
    setPrevious({ idsKey, scopeKey });
    setEntering(next);
  }
  return entering;
}

// Desktop / web column: the action over its time or status, and a single
// amount (a two-sided action shows what arrived) centered on the right. No
// date headers; counterparty, fiat value and the paid side live in the
// details.
function RecentActivityList({
  data,
  onPressHistory,
}: ITxHistoryCompactListProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const {
    activeAccount: { account, indexedAccount, network },
  } = useActiveAccount({ num: 0 });
  const isAllNetworks = !!network?.isAllNetworks;
  const vaults = useVaultDisplaySettings(data);
  const theme = useTheme();
  // The row builder reports a token's fallback letter only together with the
  // colors a list draws it in; here `Token` paints the letter itself.
  const tokenFallbackTheme = useMemo(
    () => ({
      inverseBackground: theme.bgInverse.val,
      inverseText: theme.textInverse.val,
    }),
    [theme],
  );
  const enteringIds = useEnteringIds(
    data,
    `${indexedAccount?.id ?? account?.id ?? ''}|${network?.id ?? ''}`,
  );

  const rows = useMemo<IRecentActivityRow[]>(
    () =>
      data.map((history) => {
        const { networkId } = history.decodedTx;
        const vault = vaults?.[networkId];
        const { row } = buildHistoryActivityRow({
          history,
          intl,
          tableLayout: false,
          isUTXO: vault?.isUtxo,
          localWallet: vault?.localWallet,
          hideValue: settingsValue.hideValue,
          currency: settings.currencyInfo.symbol,
          isAllNetworks,
          networkBadge: {
            logoURI: networkUtils.getLocalNetworkInfo(networkId)?.logoURI,
          },
          tokenFallbackTheme,
        });
        let status: IRecentActivityRow['status'] = 'done';
        let when = formatDistanceToNowStrict(
          history.decodedTx.updatedAt ??
            history.decodedTx.createdAt ??
            Date.now(),
          { addSuffix: true, roundingMethod: 'floor' },
        );
        if (getHistoryTxDisplayStatus(history) === EDecodedTxStatus.Pending) {
          status = 'pending';
          when = intl.formatMessage({ id: ETranslations.global_confirming });
        } else if (
          history.decodedTx.status === EDecodedTxStatus.Failed ||
          history.decodedTx.status === EDecodedTxStatus.Dropped
        ) {
          status = 'failed';
          when = intl.formatMessage({ id: ETranslations.global_failed });
        }
        // A two-sided action's primary amount is what arrived, and its
        // second (receive) visual is that token.
        const primary = row.amounts.find((amount) => amount.key === 'primary');
        return {
          history,
          title:
            row.title ||
            intl.formatMessage({
              id: ETranslations.transaction__contract_interaction,
            }),
          amount:
            primary?.text && primary.text !== '-'
              ? {
                  text: primary.text,
                  segments: primary.textSegments,
                  positive: primary.tone === 'positive',
                }
              : undefined,
          status,
          when,
          ...readLeadingVisual(row.secondaryLeading ?? row.leading),
        };
      }),
    [
      data,
      intl,
      isAllNetworks,
      settings.currencyInfo.symbol,
      settingsValue.hideValue,
      tokenFallbackTheme,
      vaults,
    ],
  );

  return (
    <YStack>
      {rows.map((row) => (
        <RecentActivityItem
          key={row.history.id}
          row={row}
          entering={enteringIds.has(row.history.id)}
          onPressHistory={onPressHistory}
        />
      ))}
    </YStack>
  );
}

const renderRecentActivityList = (props: ITxHistoryCompactListProps) => (
  <RecentActivityList {...props} />
);

const RecentHistory = memo(() => {
  const intl = useIntl();

  const renderContent = useCallback(() => {
    return (
      <TxHistoryListContainer
        plainMode
        tableLayout={false}
        limit={5}
        emptyTitle={intl.formatMessage({
          id: ETranslations.wallet_transaction_history_empty_message,
        })}
        emptyDescription={intl.formatMessage({
          id: ETranslations.wallet_transactions_empty_desc,
        })}
        // Native tablets keep the full history rows.
        renderCompactList={
          platformEnv.isNative ? undefined : renderRecentActivityList
        }
      />
    );
  }, [intl]);
  return (
    <RichBlock
      title={<RecentHistoryTitle />}
      headerContainerProps={{ px: '$pagePadding' }}
      content={renderContent()}
      plainContentContainer
    />
  );
});
RecentHistory.displayName = 'RecentHistory';

export { RecentHistory };
