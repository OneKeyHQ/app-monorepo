import { memo } from 'react';

import type { IStackProps, IYStackProps } from '@onekeyhq/components';
import type { IDecodedTxExtraTon } from '@onekeyhq/core/src/chains/ton/types';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function TxExtraInfoTon({ style }: { style?: IStackProps }) {
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const decodedTx = decodedTxs?.[0];

  const extraInfo = decodedTx?.extraInfo as IDecodedTxExtraTon;

  if (!decodedTx || !extraInfo || !extraInfo.memo) return null;

  return (
    <SignatureConfirmItem {...(style as IYStackProps)}>
      <SignatureConfirmItem.Label>Memo/Tag/Note</SignatureConfirmItem.Label>

      <SignatureConfirmItem.Value>{extraInfo.memo}</SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export default memo(TxExtraInfoTon);
