import { useCallback, useEffect } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSendConfirmActions } from '@onekeyhq/kit/src/states/jotai/contexts/send-confirm';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

type IProps = {
  accountId: string;
  networkId: string;
  unsignedTxs: IUnsignedTxPro[];
};

function TxActionsContainer(props: IProps) {
  const { accountId, networkId, unsignedTxs } = props;
  const { updateNativeTokenTransferAmount } = useSendConfirmActions().current;

  const r = usePromiseResult(
    () =>
      Promise.all(
        unsignedTxs.map((unsignedTx) =>
          backgroundApiProxy.serviceSend.buildDecodedTx({
            accountId,
            networkId,
            unsignedTx,
          }),
        ),
      ),
    [accountId, networkId, unsignedTxs],
  );

  useEffect(() => {
    const decodedTxs = r.result ?? [];

    let nativeTokenTransferBN = new BigNumber(0);
    decodedTxs.forEach((decodedTx) => {
      decodedTx.actions.forEach((action) => {
        if (action.type === EDecodedTxActionType.ASSET_TRANSFER) {
          action.assetTransfer?.sends.forEach((send) => {
            if (!send.isNFT && send.token === '') {
              nativeTokenTransferBN = nativeTokenTransferBN.plus(
                send.amount ?? 0,
              );
            }
          });
        }
      });
    });
    updateNativeTokenTransferAmount(nativeTokenTransferBN.toFixed());
  }, [r.result, updateNativeTokenTransferAmount]);

  const renderActions = useCallback(() => {
    const decodedTxs = r.result ?? [];
    return decodedTxs.map((decodedTx, index) => (
      <TxActionsListView
        key={index}
        componentType={ETxActionComponentType.DetailView}
        decodedTx={decodedTx}
      />
    ));
  }, [r.result]);

  return <YStack space="$2">{renderActions()}</YStack>;
}

export { TxActionsContainer };
