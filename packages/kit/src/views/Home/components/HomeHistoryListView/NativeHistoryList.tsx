import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';
import { View } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
  Stack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EmptySearch } from '@onekeyhq/kit/src/components/Empty';
import { EmptyHistory } from '@onekeyhq/kit/src/components/Empty/EmptyHistory';
import { HistoryLoadingView } from '@onekeyhq/kit/src/components/Loading';
import { ListFooterComponent } from '@onekeyhq/kit/src/components/TxHistoryListView';
import TxHistoryAddressInfo from '@onekeyhq/kit/src/components/TxHistoryListView/TxHistoryAddressInfo';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReplaceTx } from '@onekeyhq/kit/src/hooks/useReplaceTx';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAddressesInfoAtom,
  useSearchKeyAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/historyList';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  buildAddressMapInfoKey,
  convertToSectionGroups,
  getFilteredHistoryBySearchKey,
  getHistoryTxDisplayStatus,
} from '@onekeyhq/shared/src/utils/historyUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus, EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { useHomeNativeListTheme } from '../../hooks/useHomeNativeListTheme';
import { useHomeNativeRefresh } from '../../hooks/useHomeNativeRefresh';
import {
  FREEZE_ENGAGE_OFFSET,
  FREEZE_RELEASE_OFFSET,
} from '../../pages/hooks/historyTopFreezeUtils';

import {
  buildHistoryActivityRow,
  formatHistoryNumber,
} from './historyActivityRows';

import type { IHomeHistoryListViewProps } from './types';
import type {
  ActivityRow,
  FooterAction,
  NativeListActionAnchor,
  NativeListRef,
  NativeListSnapshot,
  RowActionEvent,
  RowModel,
} from '@onekeyfe/react-native-native-list';

type IPendingActions = {
  actions: FooterAction[];
  onAction: (event: RowActionEvent) => void;
};

function PendingActionsController({
  history,
  onUpdate,
}: {
  history: IAccountHistoryTx;
  onUpdate: (key: string, actions?: IPendingActions) => void;
}) {
  const intl = useIntl();
  const replacement = useReplaceTx({ historyTx: history });
  const {
    canReplaceTx,
    canCancelTx,
    cancelTxEnabled,
    speedUpCancelEnabled,
    checkSpeedUpStateEnabled,
    handleReplaceTx,
    handleCheckSpeedUpState,
  } = replacement;
  const actions = useMemo<FooterAction[]>(() => {
    const result: FooterAction[] = [];
    if (canReplaceTx && canCancelTx) {
      result.push({
        key: 'speed-up',
        label: intl.formatMessage({ id: ETranslations.global_speed_up }),
        tone: 'primary',
      });
      if (cancelTxEnabled)
        result.push({
          key: 'cancel',
          label: intl.formatMessage({ id: ETranslations.global_cancel }),
        });
    } else if (canReplaceTx && speedUpCancelEnabled)
      result.push({
        key: 'speed-up',
        label: intl.formatMessage({ id: ETranslations.speed_up_cancellation }),
        tone: 'primary',
      });
    if (checkSpeedUpStateEnabled)
      result.push({
        key: 'check-speed-up',
        label: intl.formatMessage({
          id: ETranslations.tx_accelerate_order_inquiry_label,
        }),
        tone: 'primary',
      });
    return result;
  }, [
    canReplaceTx,
    canCancelTx,
    cancelTxEnabled,
    speedUpCancelEnabled,
    checkSpeedUpStateEnabled,
    intl,
  ]);
  const onAction = useCallback(
    (event: RowActionEvent) => {
      if (
        !actions.some(
          (action) => action.key === event.actionKey && !action.disabled,
        )
      )
        return;
      if (event.actionKey === 'cancel') {
        void handleReplaceTx({ replaceType: EReplaceTxType.Cancel });
        return;
      }
      if (event.actionKey === 'check-speed-up') {
        void handleCheckSpeedUpState();
        return;
      }
      if (
        networkUtils.isBTCNetwork(history.decodedTx.networkId) &&
        canCancelTx
      ) {
        ActionList.show({
          title: intl.formatMessage({ id: ETranslations.global_speed_up }),
          triggerRect: event.anchor?.windowRect,
          sections: [
            {
              items: [
                {
                  label: 'RBF (coming soon)',
                  icon: 'RepeatOutline',
                  disabled: true,
                },
              ],
            },
            {
              items: [
                {
                  label: intl.formatMessage(
                    {
                      id: ETranslations.tx_accelerate_accelerator_selector_item_label,
                    },
                    { name: 'F2Pool' },
                  ),
                  icon: 'F2PoolSolid' as IKeyOfIcons,
                  onPress: () =>
                    handleReplaceTx({ replaceType: EReplaceTxType.SpeedUp }),
                },
              ],
            },
          ],
        });
      } else void handleReplaceTx({ replaceType: EReplaceTxType.SpeedUp });
    },
    [
      actions,
      handleReplaceTx,
      handleCheckSpeedUpState,
      history.decodedTx.networkId,
      canCancelTx,
      intl,
    ],
  );
  useEffect(() => {
    onUpdate(history.id, { actions, onAction });
  }, [history.id, actions, onAction, onUpdate]);
  useEffect(() => () => onUpdate(history.id), [history.id, onUpdate]);
  return null;
}

export function NativeHistoryList(props: IHomeHistoryListViewProps) {
  const {
    data,
    tableLayout = false,
    initialized,
    frozenTopEnabled,
    onAwayFromTopChange,
    ListHeaderComponent,
    onEndReached,
    isLoadingMore,
    hasMore,
    onPressHistory,
    hideValue,
  } = props;
  const intl = useIntl();
  const theme = useHomeNativeListTheme();
  const bottom = useScrollContentTabBarOffset();
  const { refreshing, onRefresh } = useHomeNativeRefresh();
  const [searchKey] = useSearchKeyAtom();
  const [addressesInfo] = useAddressesInfoAtom();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });
  const filtered = useMemo(
    () => getFilteredHistoryBySearchKey({ history: data, searchKey }),
    [data, searchKey],
  );
  const networkTargets = useMemo(
    () => [
      ...new Map(
        filtered.map((history) => {
          const { networkId, accountId } = history.decodedTx;
          return [
            JSON.stringify([networkId, accountId]),
            { networkId, accountId },
          ] as const;
        }),
      ).entries(),
    ],
    [filtered],
  );
  const networkRequestIdentity = JSON.stringify({
    scope: props.frozenTopIdentityKey,
    targets: networkTargets.toSorted(([a], [b]) => a.localeCompare(b)),
  });
  const networkCacheRef = useRef(
    new Map<
      string,
      {
        vault: Awaited<
          ReturnType<typeof backgroundApiProxy.serviceNetwork.getVaultSettings>
        >;
        token: Awaited<
          ReturnType<typeof backgroundApiProxy.serviceToken.getNativeToken>
        >;
      }
    >(),
  );
  const { result: networkData } = usePromiseResult(async () => {
    // This JSON is produced locally above; derive requests from its identity so
    // value-only row updates never restart metadata queries.
    const { targets } = JSON.parse(networkRequestIdentity) as {
      targets: [string, { networkId: string; accountId: string }][];
    };
    const cache = networkCacheRef.current;
    await promiseAllSettledEnhanced(
      targets
        .filter(([key]) => !cache.has(key))
        .map(([key, target]) => async () => {
          const [vault, token] = await Promise.all([
            backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: target.networkId,
            }),
            backgroundApiProxy.serviceToken.getNativeToken(target),
          ]);
          cache.set(key, { vault, token });
        }),
      { concurrency: 4, continueOnError: true },
    );
    return Object.fromEntries(
      targets.flatMap(([key]) => {
        const value = cache.get(key);
        return value ? [[key, value] as const] : [];
      }),
    );
  }, [networkRequestIdentity]);
  const models = useMemo(
    () =>
      new Map(
        filtered.map((history) => [
          history.id,
          buildHistoryActivityRow({
            history,
            intl,
            tableLayout,
            isUTXO:
              networkData?.[
                JSON.stringify([
                  history.decodedTx.networkId,
                  history.decodedTx.accountId,
                ])
              ]?.vault?.isUtxo,
            hideValue: !!hideValue && settingsValue.hideValue,
            currency: settings.currencyInfo.symbol,
            isAllNetworks: network?.isAllNetworks,
          }),
        ]),
      ),
    [
      filtered,
      intl,
      tableLayout,
      networkData,
      hideValue,
      settingsValue.hideValue,
      settings.currencyInfo.symbol,
      network?.isAllNetworks,
    ],
  );
  const addressTargets = useMemo(
    () => [
      ...new Map(
        filtered
          .map((history) => {
            const address = models.get(history.id)?.address ?? '';
            const networkId = history.decodedTx.networkId;
            return [
              buildAddressMapInfoKey({ networkId, address }),
              { networkId, address },
            ] as const;
          })
          .filter(([, target]) => !!target.address),
      ).entries(),
    ],
    [filtered, models],
  );
  const addressRequestIdentity = JSON.stringify({
    scope: props.frozenTopIdentityKey,
    targets: addressTargets.toSorted(([a], [b]) => a.localeCompare(b)),
  });
  const addressCacheRef = useRef(new Map<string, string | undefined>());
  const { result: localLabels, run: refreshLabels } =
    usePromiseResult(async () => {
      const { targets } = JSON.parse(addressRequestIdentity) as {
        targets: [string, { networkId: string; address: string }][];
      };
      const cache = addressCacheRef.current;
      await promiseAllSettledEnhanced(
        targets
          .filter(([key]) => !cache.has(key))
          .map(([key, target]) => async () => {
            const result =
              await backgroundApiProxy.serviceAccountProfile.queryAddress({
                ...target,
                enableAddressBook: true,
                enableWalletName: true,
                skipValidateAddress: true,
              });
            cache.set(key, result.addressBookName || result.walletAccountName);
          }),
        { concurrency: 4, continueOnError: true },
      );
      return Object.fromEntries(targets.map(([key]) => [key, cache.get(key)]));
    }, [addressRequestIdentity]);
  useEffect(() => {
    const update = async () => {
      addressCacheRef.current = new Map();
      await backgroundApiProxy.serviceAccount.clearAccountNameFromAddressCache();
      await refreshLabels({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, update);
    appEventBus.on(EAppEventBusNames.AccountUpdate, update);
    appEventBus.on(EAppEventBusNames.AddressBookUpdate, update);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, update);
      appEventBus.off(EAppEventBusNames.AccountUpdate, update);
      appEventBus.off(EAppEventBusNames.AddressBookUpdate, update);
    };
  }, [refreshLabels]);
  const pendingActionsRef = useRef(new Map<string, IPendingActions>());
  const [pendingActions, setPendingActions] = useState(
    new Map<string, FooterAction[]>(),
  );
  const updatePending = useCallback((key: string, value?: IPendingActions) => {
    if (value) pendingActionsRef.current.set(key, value);
    else pendingActionsRef.current.delete(key);
    setPendingActions((previous) => {
      if (isEqual(previous.get(key), value?.actions)) return previous;
      const next = new Map(previous);
      if (value) next.set(key, value.actions);
      else next.delete(key);
      return next;
    });
  }, []);
  const sections = useMemo(
    () =>
      convertToSectionGroups({
        items: filtered,
        formatDate: (date) =>
          formatDate(new Date(date), { hideTimeForever: true }),
      }),
    [filtered],
  );
  const rows = useMemo<RowModel[]>(
    () =>
      sections.flatMap((section, sectionIndex) => {
        const sectionKey = `section:${section.titleKey ?? section.title ?? sectionIndex}`;
        const pending =
          getHistoryTxDisplayStatus(section.data[0]) ===
          EDecodedTxStatus.Pending;
        const header: RowModel = {
          key: sectionKey,
          type: 'sectionHeader',
          sectionKey,
          height: (sectionIndex === 0 ? 32 : 52) + (pending ? 4 : 0),
          titleLoading: pending,
          title: pending
            ? intl.formatMessage({ id: ETranslations.global_confirming })
            : section.title || intl.formatMessage({ id: section.titleKey }),
          style: {
            container: { contentVerticalAlignment: 'bottom' },
            horizontalPadding: 20,
            verticalPadding: 8,
            title: {
              fontSize: 12,
              lineHeight: 16,
              fontWeight: 'semibold',
              color: pending ? theme.caution : theme.secondaryText,
            },
          },
        };
        return [
          header,
          ...section.data.map((history): ActivityRow => {
            const model = models.get(history.id);
            if (!model)
              throw new OneKeyLocalError('Missing native history row model');
            const addressKey = buildAddressMapInfoKey({
              networkId: history.decodedTx.networkId,
              address: model.address,
            });
            const badge = addressesInfo[addressKey];
            const localLabel = badge?.label || localLabels?.[addressKey];
            let description = model.row.description;
            if (localLabel) {
              description = model.row.description?.includes(' • ')
                ? `${model.row.description.split(' • ')[0]} • ${localLabel}`
                : localLabel;
            }
            const info =
              networkData?.[
                JSON.stringify([
                  history.decodedTx.networkId,
                  history.decodedTx.accountId,
                ])
              ];
            return {
              ...model.row,
              sectionKey,
              description,
              descriptionActionKey: badge ? 'address-info' : undefined,
              footerActions: pendingActions.get(history.id),
              fee: tableLayout
                ? {
                    label: intl.formatMessage({
                      id: ETranslations.swap_history_detail_network_fee,
                    }),
                    primary: formatHistoryNumber(
                      history.decodedTx.totalFeeInNative ?? '-',
                      { balance: true, symbol: info?.token?.symbol },
                    ).text,
                    primaryTextSegments: formatHistoryNumber(
                      history.decodedTx.totalFeeInNative ?? '-',
                      { balance: true, symbol: info?.token?.symbol },
                    ).textSegments,
                    secondaryTextSegments: history.decodedTx.totalFeeFiatValue
                      ? formatHistoryNumber(
                          history.decodedTx.totalFeeFiatValue,
                          { currency: settings.currencyInfo.symbol },
                        ).textSegments
                      : undefined,
                    secondary: history.decodedTx.totalFeeFiatValue
                      ? formatHistoryNumber(
                          history.decodedTx.totalFeeFiatValue,
                          { currency: settings.currencyInfo.symbol },
                        ).text
                      : undefined,
                    hidden: info?.vault.hideFeeInfoInHistoryList,
                  }
                : undefined,
            };
          }),
        ];
      }),
    [
      sections,
      intl,
      theme,
      models,
      addressesInfo,
      localLabels,
      networkData,
      pendingActions,
      tableLayout,
      settings.currencyInfo.symbol,
    ],
  );
  const snapshot = useMemo<NativeListSnapshot>(
    () => ({
      schemaVersion: 1,
      generation: 1,
      layout: {
        kind: 'sectioned',
        stickyHeaders: false,
        contentPaddingTop: 12,
        contentPaddingBottom: bottom ?? 0,
      },
      rows,
      theme,
      capabilities: {
        pullToRefresh: true,
        refreshing,
        refreshTriggerDistance: 65,
        loadMore: !!onEndReached && !!hasMore && !isLoadingMore,
        endReachedThreshold: props.onEndReachedThreshold ?? 0.2,
      },
    }),
    [
      rows,
      theme,
      bottom,
      refreshing,
      onEndReached,
      hasMore,
      isLoadingMore,
      props.onEndReachedThreshold,
    ],
  );
  const containerRef = useRef<View>(null);
  const listRef = useRef<NativeListRef>(null);
  const [addressInfo, setAddressInfo] = useState<{
    address: string;
    badge: IAddressBadge;
    anchor: NativeListActionAnchor;
    left: number;
    top: number;
  }>();
  const closeAddressInfo = useCallback(() => {
    setAddressInfo((current) => {
      if (current)
        listRef.current?.setActionAnchorState({
          token: current.anchor.token,
          open: false,
          restoreFocus: true,
        });
      return undefined;
    });
  }, []);
  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      if (!event.rowKey) return;
      const history = filtered.find((tx) => tx.id === event.rowKey);
      if (!history) return;
      if (event.actionKey === 'press') onPressHistory?.(history);
      else if (event.actionKey === 'address-info') {
        const address = models.get(history.id)?.address ?? '';
        const badge =
          addressesInfo[
            buildAddressMapInfoKey({
              networkId: history.decodedTx.networkId,
              address,
            })
          ];
        const anchor = event.anchor;
        if (badge && anchor) {
          listRef.current?.setActionAnchorState({
            token: anchor.token,
            open: true,
          });
          containerRef.current?.measureInWindow((x, y) =>
            setAddressInfo({
              address,
              badge,
              anchor,
              left: anchor.windowRect.x - x,
              top: anchor.windowRect.y - y,
            }),
          );
        }
      } else pendingActionsRef.current.get(history.id)?.onAction(event);
    },
    [filtered, onPressHistory, models, addressesInfo],
  );
  const empty = useMemo(() => {
    if (!initialized) return <HistoryLoadingView tableLayout={tableLayout} />;
    if (searchKey && data.length) return <EmptySearch />;
    return (
      <EmptyHistory
        showViewInExplorer
        walletId={props.walletId}
        accountId={props.accountId}
        networkId={props.networkId}
        indexedAccountId={props.indexedAccountId}
        isSingleAccount={props.isSingleAccount}
        tokenMap={props.tokenMap}
      />
    );
  }, [
    initialized,
    tableLayout,
    searchKey,
    data.length,
    props.walletId,
    props.accountId,
    props.networkId,
    props.indexedAccountId,
    props.isSingleAccount,
    props.tokenMap,
  ]);
  return (
    <View ref={containerRef} style={{ flex: 1 }}>
      {filtered
        .filter(
          (history) =>
            getHistoryTxDisplayStatus(history) === EDecodedTxStatus.Pending,
        )
        .map((history) => (
          <PendingActionsController
            key={history.id}
            history={history}
            onUpdate={updatePending}
          />
        ))}
      <NativeList
        ref={listRef}
        onActionAnchorInvalidated={closeAddressInfo}
        testID="home-history-list"
        style={{ flex: 1 }}
        snapshot={snapshot}
        listHeader={ListHeaderComponent}
        listEmpty={empty}
        listFooter={
          <ListFooterComponent
            showFooter={props.showFooter}
            hasItems={filtered.length > 0}
            accountId={props.accountId}
            networkId={props.networkId}
            walletId={props.walletId}
            indexedAccountId={props.indexedAccountId}
            isSingleAccount={props.isSingleAccount}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
          />
        }
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        onRowAction={handleRowAction}
        scrollPositionThresholds={{
          start: FREEZE_RELEASE_OFFSET,
          end: FREEZE_ENGAGE_OFFSET,
          enabled: frozenTopEnabled,
        }}
        onScrollPositionThresholdChange={({ isBeyondThreshold }) =>
          onAwayFromTopChange(isBeyondThreshold)
        }
      />
      {addressInfo ? (
        <Stack
          position="absolute"
          left={addressInfo.left}
          top={addressInfo.top}
          width={addressInfo.anchor.windowRect.width}
          height={addressInfo.anchor.windowRect.height}
          pointerEvents="box-none"
        >
          <TxHistoryAddressInfo
            address={addressInfo.address}
            badge={addressInfo.badge}
            popoverProps={{
              open: true,
              onOpenChange: (open) => {
                if (!open) closeAddressInfo();
              },
              renderTrigger: (
                <Stack
                  width={addressInfo.anchor.windowRect.width}
                  height={addressInfo.anchor.windowRect.height}
                  pointerEvents="none"
                />
              ),
            }}
          />
        </Stack>
      ) : null}
    </View>
  );
}
