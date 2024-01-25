import { useCallback } from 'react';

import { YStack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETxActionComponentType } from '@onekeyhq/shared/types';

type IProps = {
  accountId: string;
  networkId: string;
  unsignedTxs: IUnsignedTxPro[];
};

function TxActionsContainer(props: IProps) {
  const { accountId, networkId, unsignedTxs } = props;

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
