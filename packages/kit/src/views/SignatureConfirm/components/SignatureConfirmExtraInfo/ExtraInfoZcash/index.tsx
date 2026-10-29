import { ZcashMemo } from '@onekeyhq/kit/src/components/ZcashMemo';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { getZcashMemoDisplay } from '@onekeyhq/shared/src/utils/zcashMemo';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

import { getZcashEncodedTx } from './zcashConfirmDisplay';

export default function TxExtraInfoZcash() {
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const decodedTx = decodedTxs?.[0];
  const tx = getZcashEncodedTx(decodedTx?.encodedTx);
  if (!decodedTx || !tx) return null;
  const memo = tx.zcashMemoHex
    ? getZcashMemoDisplay(tx.zcashMemoHex)
    : undefined;
  if (!memo) return null;
  return (
    <SignatureConfirmItem>
      <ZcashMemo text={memo.text} binaryMemos={[memo]} />
    </SignatureConfirmItem>
  );
}
