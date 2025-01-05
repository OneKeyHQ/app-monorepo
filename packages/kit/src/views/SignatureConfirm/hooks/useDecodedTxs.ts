import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

function useDecodedTxs(params: {
  accountId: string;
  networkId: string;
  unsignedTxs: IUnsignedTxPro[];
  accountAddress?: string;
  transferPayload?: ITransferPayload;
}) {
  const { accountId, networkId, unsignedTxs, accountAddress, transferPayload } =
    params;

  const { result: decodedTxs, isLoading: isBuildingDecodedTxs } =
    usePromiseResult(
      async () => {
        const r = await Promise.all(
          unsignedTxs.map((unsignedTx) =>
            backgroundApiProxy.serviceSignatureConfirm.buildDecodedTx({
              accountId,
              networkId,
              accountAddress,
              unsignedTx,
              transferPayload,
            }),
          ),
        );
        return r;
      },
      [unsignedTxs, transferPayload, accountId, networkId, accountAddress],
      {
        watchLoading: true,
      },
    );

  return { decodedTxs, isBuildingDecodedTxs };
}

export { useDecodedTxs };
