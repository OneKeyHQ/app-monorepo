import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDebugRenderTrackerProps } from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsLedgerUpdatesAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPerpsDepositOrderAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IDepositPending,
  IHex,
  IUserNonFundingLedgerUpdate,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { usePerpDepositOrder } from '../../../hooks/usePerpDeposit';
import { AccountRow } from '../Components/AccountRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

interface IPerpAccountListProps {
  isMobile?: boolean;
  useTabsList?: boolean;
  disableListScroll?: boolean;
  ListHeaderComponent?: ReactElement | null;
}

function PerpAccountList({
  isMobile,
  useTabsList,
  disableListScroll,
  ListHeaderComponent,
}: IPerpAccountListProps) {
  const intl = useIntl();
  const [{ updates, isSubscribed }] = usePerpsLedgerUpdatesAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const actions = useHyperliquidActions();
  const [currentListPage, setCurrentListPage] = useState(1);
  const { perpDepositOrder } = usePerpDepositOrder({
    accountId: currentUser?.accountId,
    indexedAccountId: currentUser?.indexedAccountId,
  });
  useEffect(() => {
    noop(currentUser?.accountAddress);
    setCurrentListPage(1);
  }, [currentUser?.accountAddress]);

  const columnsConfig: IColumnConfig[] = useMemo(
    () => [
      {
        key: 'time',
        title: intl.formatMessage({ id: ETranslations.global_time }),
        minWidth: 140,
        align: 'left',
      },
      {
        key: 'status',
        title: intl.formatMessage({ id: ETranslations.global_status }),
        minWidth: 120,
        align: 'left',
      },
      {
        key: 'action',
        title: intl.formatMessage({ id: ETranslations.perp_account_action }),
        minWidth: 120,
        align: 'left',
        flex: 1,
      },
      {
        key: 'amount',
        title: intl.formatMessage({
          id: ETranslations.dexmarket_details_history_amount,
        }),
        minWidth: 140,
        align: 'left',
        flex: 1,
      },
      {
        key: 'fee',
        title: intl.formatMessage({ id: ETranslations.fee_fee }),
        minWidth: 100,
        align: 'right',
        flex: 1,
      },
    ],
    [intl],
  );

  const totalMinWidth = useMemo(
    () =>
      columnsConfig.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [columnsConfig],
  );
  const mergedData = useMemo(() => {
    const depositUpdates: IUserNonFundingLedgerUpdate[] = perpDepositOrder
      .map((order: IPerpsDepositOrderAtom) => {
        const delta: IDepositPending = {
          type: 'deposit',
          usdc: order.amount,
          status: order.status,
        };
        return {
          time: order.time ?? Date.now(),
          hash: (order.toTxId || order.fromTxId || '0x') as IHex,
          delta,
        };
      })
      .filter((update) => update.delta.status === ESwapTxHistoryStatus.PENDING);

    const allUpdates = [...updates, ...depositUpdates];
    const sortedUpdates = allUpdates.sort((a, b) => b.time - a.time);

    const seenHashes = new Set<string>();
    return sortedUpdates.filter((update) => {
      if (!update.hash) {
        return true;
      }
      if (seenHashes.has(update.hash)) {
        return false;
      }
      seenHashes.add(update.hash);
      return true;
    });
  }, [updates, perpDepositOrder]);

  const renderAccountRow = (
    item: IUserNonFundingLedgerUpdate,
    index: number,
  ) => {
    return (
      <AccountRow
        update={item}
        isMobile={isMobile}
        cellMinWidth={totalMinWidth}
        columnConfigs={columnsConfig}
        index={index}
      />
    );
  };

  return (
    <CommonTableListView
      onPullToRefresh={async () => {
        await actions.current.refreshAllPerpsData();
      }}
      listViewDebugRenderTrackerProps={useMemo(
        (): IDebugRenderTrackerProps => ({
          name: 'PerpAccountList',
          position: 'top-left',
        }),
        [],
      )}
      useTabsList={useTabsList}
      disableListScroll={disableListScroll}
      currentListPage={currentListPage}
      setCurrentListPage={setCurrentListPage}
      enablePagination
      paginationToBottom={isMobile}
      columns={columnsConfig}
      minTableWidth={totalMinWidth}
      data={mergedData}
      isMobile={isMobile}
      renderRow={renderAccountRow}
      // If account has no Perp address (unsupported or not created),
      // show empty state instead of skeleton loading.
      listLoading={currentUser?.accountAddress ? !isSubscribed : false}
      emptyMessage={intl.formatMessage({
        id: ETranslations.perp_trade_history_empty,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_trade_history_empty_desc,
      })}
      ListHeaderComponent={mergedData.length > 0 ? ListHeaderComponent : null}
    />
  );
}

export { PerpAccountList };
