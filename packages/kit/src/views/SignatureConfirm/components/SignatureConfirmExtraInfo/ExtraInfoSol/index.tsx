import { memo } from 'react';

import type { IDecodedTxExtraSol } from '@onekeyhq/core/src/chains/sol/types';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function TxExtraInfoSol() {
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const decodedTx = decodedTxs?.[0];

  const extraInfo = decodedTx?.extraInfo as IDecodedTxExtraSol;

  if (!decodedTx || !extraInfo || !extraInfo.createTokenAccountFee) return null;

  // TODO: i18n
  return (
    <SignatureConfirmItem>
      <SignatureConfirmItem.Label>Account Rent</SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>
        {`${extraInfo.createTokenAccountFee.amount} ${extraInfo.createTokenAccountFee.symbol}`}
      </SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export default memo(TxExtraInfoSol);
