import { useEffect, useMemo, useState } from 'react';

import {
  IDecodedTx,
  IDecodedTxInteractInfo,
  IDecodedTxLegacy,
  IEncodedTx,
} from '@onekeyhq/engine/src/vaults/types';

import { IDappSourceInfo } from '../background/IBackgroundApi';
import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useActiveWalletAccount } from './redux';

// TODO move to serviceDapp getDappInteractInfo()
export function useInteractWithInfo({
  sourceInfo,
}: {
  sourceInfo?: IDappSourceInfo;
}) {
  const info: IDecodedTxInteractInfo | undefined = useMemo(() => {
    if (sourceInfo?.origin) {
      return {
        url: sourceInfo?.origin,
        name: '',
        description: '',
        icons: [],
        provider: sourceInfo?.scope,
      };
    }
  }, [sourceInfo?.origin, sourceInfo?.scope]);

  return info;
}

function useDecodedTx({
  encodedTx,
  payload,
  sourceInfo,
}: {
  encodedTx: IEncodedTx | null | undefined;
  payload?: any;
  sourceInfo?: IDappSourceInfo;
}) {
  const [decodedTxLegacy, setDecodedTxLegacy] =
    useState<IDecodedTxLegacy | null>(null);
  const [decodedTx, setDecodedTx] = useState<IDecodedTx | null>(null);
  const { networkId, accountId } = useActiveWalletAccount();
  const { engine } = backgroundApiProxy;
  const interactInfo = useInteractWithInfo({ sourceInfo });
  useEffect(() => {
    if (!encodedTx) {
      return;
    }
    (async () => {
      // TODO move to SendConfirm
      const result = await engine.decodeTx({
        networkId,
        accountId,
        encodedTx,
        payload,
        interactInfo,
      });
      setDecodedTx(result.decodedTx);
      setDecodedTxLegacy(result.decodedTxLegacy);
    })();
  }, [accountId, encodedTx, engine, interactInfo, networkId, payload]);
  return { decodedTx, decodedTxLegacy };
}

export { useDecodedTx };
