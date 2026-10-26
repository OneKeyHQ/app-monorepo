import { useIntl } from 'react-intl';

import { ZcashMemo } from '@onekeyhq/kit/src/components/ZcashMemo';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getZcashMemoDisplay } from '@onekeyhq/shared/src/utils/zcashMemo';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

import {
  getZcashConfirmFromPool,
  getZcashEncodedTx,
} from './zcashConfirmDisplay';

export default function TxExtraInfoZcash() {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const decodedTx = decodedTxs?.[0];
  const tx = getZcashEncodedTx(decodedTx?.encodedTx);
  if (!decodedTx || !tx) return null;
  const fromPool = getZcashConfirmFromPool(tx);
  const memo = tx.zcashMemoHex
    ? getZcashMemoDisplay(tx.zcashMemoHex)
    : undefined;
  return (
    <>
      {fromPool ? (
        <SignatureConfirmItem>
          <SignatureConfirmItem.Label>
            {intl.formatMessage({ id: ETranslations.global_from })}
          </SignatureConfirmItem.Label>
          <SignatureConfirmItem.Value>{fromPool}</SignatureConfirmItem.Value>
        </SignatureConfirmItem>
      ) : null}
      {memo ? (
        <SignatureConfirmItem>
          <ZcashMemo text={memo.text} binaryMemos={[memo]} />
        </SignatureConfirmItem>
      ) : null}
    </>
  );
}
