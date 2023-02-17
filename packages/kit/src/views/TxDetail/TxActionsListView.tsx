import { useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, Divider, VStack } from '@onekeyhq/components';
import type { IHistoryTx } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNetworkSimple } from '../../hooks';
import { MAX_ACTIONS_DISPLAY_IN_HISTORY_ITEM } from '../Send/constants';

import { TxActionErrorBoundary } from './components/TxActionErrorBoundary';
import { TxMoreInfo, TxMoreInfoT0 } from './TxAction/TxMoreInfo';
import { getTxActionMeta } from './utils/getTxActionMeta';
import { getDisplayedActions } from './utils/utilsTxDetail';

import type { ITxActionListViewProps } from './types';

const moreInfoComponent = {
  T0: TxMoreInfoT0,
  T1: TxMoreInfo,
  T2: TxMoreInfo,
};

function useOriginHistoryTxOfCancelTx(cancelTx?: IHistoryTx) {
  const [originTx, setOriginTx] = useState<IHistoryTx | undefined>();
  useEffect(() => {
    (async () => {
      const tx =
        await backgroundApiProxy.serviceHistory.getOriginHistoryTxOfCancelTx(
          cancelTx,
        );
      setOriginTx(tx);
    })();
  }, [cancelTx]);
  return originTx;
}

export function TxActionsListView(props: ITxActionListViewProps) {
  const {
    historyTx,
    decodedTx,
    transformType = 'T0',
    space = 0,
    showDivider = false,
    showConnectionLine = false,
    transferAmount,
  } = props;
  const intl = useIntl();
  const originTx = useOriginHistoryTxOfCancelTx(historyTx);
  const network = useNetworkSimple(decodedTx.networkId);
  const items = useMemo(() => {
    const finalDecodedTx = { ...decodedTx };
    if (originTx) {
      finalDecodedTx.actions = originTx.decodedTx.actions;
      finalDecodedTx.outputActions = originTx.decodedTx.outputActions;
    }
    const displayedActions = getDisplayedActions({ decodedTx: finalDecodedTx });
    const listItems: JSX.Element[] = [];

    const actionCount = displayedActions.length;
    for (
      let i = 0,
        len = BigNumber.min(
          actionCount,
          MAX_ACTIONS_DISPLAY_IN_HISTORY_ITEM,
        ).toNumber();
      i < len;
      i += 1
    ) {
      const action = displayedActions[i];
      const metaInfo = getTxActionMeta({
        action,
        decodedTx: finalDecodedTx,
        intl,
        historyTx,
      });
      metaInfo.meta.transferAmount = transferAmount;

      const { meta, components } = metaInfo;
      const TxActionComponent = components[transformType];

      listItems.push(
        <TxActionErrorBoundary key={`error-boundary-${i}`}>
          <TxActionComponent
            key={i}
            {...metaInfo.props}
            meta={meta}
            network={network}
          />
        </TxActionErrorBoundary>,
      );
      if (showDivider && i !== displayedActions.length - 1) {
        // actions in same tx do not need divider anymore
        // listItems.push(<Divider key={`${index}-divider`} />);
      }
    }

    if (actionCount > MAX_ACTIONS_DISPLAY_IN_HISTORY_ITEM) {
      const TxMoreInfoComponent = moreInfoComponent[transformType];
      listItems.push(
        <TxMoreInfoComponent
          decodedTx={finalDecodedTx}
          iconInfo={{ icon: { name: 'EllipsisVerticalMini' } }}
          titleInfo={{
            title: intl.formatMessage(
              { id: 'action__str_more_actions' },
              { count: actionCount - MAX_ACTIONS_DISPLAY_IN_HISTORY_ITEM },
            ),
          }}
        />,
      );
    }
    return listItems;
  }, [
    decodedTx,
    historyTx,
    intl,
    network,
    originTx,
    showDivider,
    transferAmount,
    transformType,
  ]);

  const connectionLine =
    items.length > 1 && showConnectionLine ? (
      <Divider
        testID="TxActionsListView-ConnectionLine"
        orientation="vertical"
        position="absolute"
        left={4}
        top={6}
        bottom={7}
        height="auto"
        thickness={2}
      />
    ) : null;

  return (
    <Box testID="TxActionsListView">
      {connectionLine}
      <VStack space={space}>{items}</VStack>
    </Box>
  );
}
