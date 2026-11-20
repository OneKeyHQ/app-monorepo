import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import PreSwapConfirmResult from '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnServerOrderDetail } from '@onekeyhq/shared/types/staking';
import {
  ESwapStepStatus,
  ESwapStepType,
} from '@onekeyhq/shared/types/swap/types';

type IOrderScope = { accountId: string; networkId: string; orderId: string };

function ServerExecutedOrderResult({
  scope,
  onOrder,
  onDone,
}: {
  scope: IOrderScope;
  onOrder: (order: IEarnServerOrderDetail) => void;
  onDone: () => void;
}) {
  const intl = useIntl();
  const [order, setOrder] = useState<IEarnServerOrderDetail>();

  useEffect(() => {
    let dismissed = false;
    const updateOrder = (next?: IEarnServerOrderDetail) => {
      if (next && !dismissed) {
        setOrder(next);
        onOrder(next);
      }
    };
    const trackOrder = async () => {
      const timeoutMs = 5 * 60 * 1000;
      const deadline = Date.now() + timeoutMs;
      const first =
        await backgroundApiProxy.serviceStaking.waitForServerExecutedOrder({
          ...scope,
          returnOnBroadcast: true,
          timeoutMs,
        });
      updateOrder(first.order);
      const remainingMs = deadline - Date.now();
      if (first.status === 'submitted' && !dismissed && remainingMs > 0) {
        const final =
          await backgroundApiProxy.serviceStaking.waitForServerExecutedOrder({
            ...scope,
            timeoutMs: remainingMs,
          });
        updateOrder(final.order);
      }
    };

    // Losing the order read does not change the accepted order on the server.
    void trackOrder().catch(() => undefined);
    return () => {
      dismissed = true;
    };
  }, [onOrder, scope]);

  let status = ESwapStepStatus.PENDING;
  if (order?.status === 'success') {
    status = ESwapStepStatus.SUCCESS;
  } else if (order?.status === 'failed') {
    status = ESwapStepStatus.FAILED;
  }

  return (
    <PreSwapConfirmResult
      lastStep={{
        type: ESwapStepType.SEND_TX,
        status,
        txHash: order?.txId,
        errorMessage: order?.errorMessage,
      }}
      fromToken={{
        networkId: scope.networkId,
        contractAddress: '',
        symbol: '',
        decimals: 0,
      }}
      pendingTitle={
        order?.txId
          ? undefined
          : intl.formatMessage({ id: ETranslations.global_processing })
      }
      showPendingHistoryHint={Boolean(order?.txId)}
      allowRetry={false}
      onConfirm={onDone}
    />
  );
}

export function showServerExecutedOrderDialog(
  scope: IOrderScope,
): Promise<IEarnServerOrderDetail | undefined> {
  return new Promise((resolve) => {
    let latestOrder: IEarnServerOrderDetail | undefined;
    const dialog = Dialog.show({
      showExitButton: true,
      showFooter: false,
      onClose: () => resolve(latestOrder),
      renderContent: (
        <ServerExecutedOrderResult
          scope={scope}
          onOrder={(order) => {
            latestOrder = order;
          }}
          onDone={() => {
            void dialog.close();
          }}
        />
      ),
    });
  });
}
