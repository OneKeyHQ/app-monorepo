import { useEffect, useMemo, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDebugRenderTrackerProps } from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsLedgerUpdatesAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IUserNonFundingLedgerUpdate } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { AccountRow } from '../Components/AccountRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

interface IPerpAccountListProps {
  isMobile?: boolean;
  useTabsList?: boolean;
  disableListScroll?: boolean;
}

function PerpAccountList({
  isMobile,
  useTabsList,
  disableListScroll,
}: IPerpAccountListProps) {
  const intl = useIntl();
  const [{ updates, isSubscribed }] = usePerpsLedgerUpdatesAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const actions = useHyperliquidActions();
  const [currentListPage, setCurrentListPage] = useState(1);

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
        title: 'Action',
        minWidth: 120,
        align: 'left',
        flex: 1,
      },
      {
        key: 'amount',
        title: 'Amount',
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
      data={updates}
      isMobile={isMobile}
      renderRow={renderAccountRow}
      listLoading={!isSubscribed}
      emptyMessage={intl.formatMessage({
        id: ETranslations.perp_trade_history_empty,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_trade_history_empty_desc,
      })}
    />
  );
}

export { PerpAccountList };
