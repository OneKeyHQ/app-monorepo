import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  Dialog,
  Icon,
  Page,
  Select,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import {
  EProtocolOfExchange,
  ESwapCleanHistorySource,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import SwapMarketHistoryList from '../components/SwapMarketHistoryList';
import { SwapProviderMirror } from '../SwapProviderMirror';

import LimitOrderListModalWithAllProvider from './LimitOrderListModal';

import type { RouteProp } from '@react-navigation/core';

const SwapHistoryListModal = ({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryList>
    >();
  const { type } = route.params;
  const [historyType, setHistoryType] = useState<EProtocolOfExchange>(
    type ?? EProtocolOfExchange.SWAP,
  );
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const { result: swapTxHistoryList } = usePromiseResult(
    async () => {
      const histories =
        await backgroundApiProxy.serviceSwap.fetchSwapHistoryListFromSimple();
      return histories;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swapHistoryPendingList],
    { watchLoading: true },
  );

  const onDeleteHistory = useCallback(() => {
    // dialog
    if (!swapTxHistoryList?.length) return;
    Dialog.show({
      icon: 'BroomOutline',
      // description: intl.formatMessage({
      //   id: ETranslations.swap_history_all_history_content,
      // }),
      title: intl.formatMessage({
        id: ETranslations.swap_history_all_history_title,
      }),
      onConfirm: async () => {
        await backgroundApiProxy.serviceSwap.cleanSwapHistoryItems();
        void backgroundApiProxy.serviceApp.showToast({
          method: 'success',
          title: intl.formatMessage({
            id: ETranslations.settings_clear_successful,
          }),
        });
        defaultLogger.swap.cleanSwapOrder.cleanSwapOrder({
          cleanFrom: ESwapCleanHistorySource.LIST,
        });
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_clear,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
    });
  }, [intl, swapTxHistoryList?.length]);

  const onDeletePendingHistory = useCallback(() => {
    // dialog
    if (
      !swapTxHistoryList?.some(
        (item) => item.status === ESwapTxHistoryStatus.PENDING,
      )
    )
      return;
    Dialog.show({
      icon: 'BroomOutline',
      description: intl.formatMessage({
        id: ETranslations.swap_history_pending_history_content,
      }),
      title: intl.formatMessage({
        id: ETranslations.swap_history_pending_history_title,
      }),
      onConfirm: () => {
        void backgroundApiProxy.serviceSwap.cleanSwapHistoryItems([
          ESwapTxHistoryStatus.PENDING,
        ]);
        defaultLogger.swap.cleanSwapOrder.cleanSwapOrder({
          cleanFrom: ESwapCleanHistorySource.LIST,
        });
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_clear,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
    });
  }, [intl, swapTxHistoryList]);

  const deleteButton = useCallback(
    () => (
      <ActionList
        title={intl.formatMessage({
          id: ETranslations.global_clear,
        })}
        items={[
          {
            label: intl.formatMessage({
              id: ETranslations.swap_history_pending_history,
            }),
            onPress: onDeletePendingHistory,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.swap_history_all_history,
            }),
            onPress: onDeleteHistory,
          },
        ]}
        renderTrigger={
          <Button variant="tertiary">
            {intl.formatMessage({ id: ETranslations.global_clear })}
          </Button>
        }
      />
    ),
    [intl, onDeleteHistory, onDeletePendingHistory],
  );

  const headerSelectType = useMemo(() => {
    const title =
      historyType === EProtocolOfExchange.LIMIT
        ? intl.formatMessage({
            id: ETranslations.swap_page_limit_dialog_title,
          })
        : intl.formatMessage({
            id: ETranslations.perp_trade_market,
          });
    return (
      <Select
        title={title}
        items={[
          {
            label: intl.formatMessage({
              id: ETranslations.perp_trade_market,
            }),
            value: EProtocolOfExchange.SWAP,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.swap_page_limit_dialog_title,
            }),
            value: EProtocolOfExchange.LIMIT,
          },
        ]}
        onChange={(value) => {
          setHistoryType(value as EProtocolOfExchange);
        }}
        value={historyType}
        renderTrigger={(props) => (
          <XStack {...props} alignItems="center" gap="$1" cursor="pointer">
            <SizableText size="$headingLg">{title}</SizableText>
            <Icon name="ChevronDownSmallSolid" size="$5" />
          </XStack>
        )}
      />
    );
  }, [historyType, intl]);
  const { gtMd } = useMedia();
  return (
    <Page>
      <Page.Header
        headerRight={
          historyType === EProtocolOfExchange.LIMIT ? undefined : deleteButton
        }
        headerTitleAlign={gtMd ? 'left' : 'center'}
        headerTitle={() => headerSelectType}
      />
      {historyType !== EProtocolOfExchange.LIMIT ? (
        <YStack flex={1}>
          <SwapMarketHistoryList />
        </YStack>
      ) : (
        <LimitOrderListModalWithAllProvider storeName={storeName} />
      )}
    </Page>
  );
};

const SwapHistoryListModalWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryList>
    >();
  const { storeName } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapHistoryListModal storeName={storeName} />
    </SwapProviderMirror>
  );
};

export default SwapHistoryListModalWithProvider;
