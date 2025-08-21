import { memo } from 'react';

import type { IStackProps, IYStackProps } from '@onekeyhq/components';
import type { IDecodedTxExtraAlgo } from '@onekeyhq/core/src/chains/algo/types';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function TxExtraInfoAlgo({ style }: { style?: IStackProps }) {
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const decodedTx = decodedTxs?.[0];

  const extraInfo = decodedTx?.extraInfo as IDecodedTxExtraAlgo;

  if (!decodedTx || !extraInfo || !extraInfo.note) return null;

  return (
    <SignatureConfirmItem {...(style as IYStackProps)}>
      <SignatureConfirmItem.Label>Memo/Tag/Note</SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>{extraInfo.note}</SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export default memo(TxExtraInfoAlgo);
