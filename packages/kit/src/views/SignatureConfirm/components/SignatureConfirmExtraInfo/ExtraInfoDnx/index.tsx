import { memo } from 'react';

import type { IStackProps, IYStackProps } from '@onekeyhq/components';
import type { IDecodedTxExtraDnx } from '@onekeyhq/core/src/chains/dnx/types';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function TxExtraInfoDnx({ style }: { style?: IStackProps }) {
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const decodedTx = decodedTxs?.[0];

  const extraInfo = decodedTx?.extraInfo as IDecodedTxExtraDnx;

  if (!decodedTx || !extraInfo || !extraInfo.paymentId) return null;

  return (
    <SignatureConfirmItem {...(style as IYStackProps)}>
      <SignatureConfirmItem.Label>Payment ID</SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>
        {extraInfo.paymentId}
      </SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export default memo(TxExtraInfoDnx);
