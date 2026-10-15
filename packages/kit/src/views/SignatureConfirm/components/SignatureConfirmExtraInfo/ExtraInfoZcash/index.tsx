import { useIntl } from 'react-intl';

import { ZcashMemo } from '@onekeyhq/kit/src/components/ZcashMemo';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type { IEncodedTxZcash } from '@onekeyhq/kit-bg/src/vaults/impls/zcash/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getZcashMemoDisplay } from '@onekeyhq/shared/src/utils/zcashMemo';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

export default function TxExtraInfoZcash() {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const tx = decodedTxs?.[0]?.encodedTx as IEncodedTxZcash | undefined;
  if (!tx?.zcashMode) return null;
  let source = 'Shielded';
  if (tx.zcashMode === 'transparent') source = 'Transparent';
  else if (tx.zcashSpendSource === 'ironwood') source = 'Ironwood';
  else if (tx.zcashSpendSource === 'orchard') source = 'Orchard';
  const memo = tx.zcashMemoHex
    ? getZcashMemoDisplay(tx.zcashMemoHex)
    : undefined;
  return (
    <>
      <SignatureConfirmItem>
        <SignatureConfirmItem.Label>
          {intl.formatMessage({ id: ETranslations.global_from })}
        </SignatureConfirmItem.Label>
        <SignatureConfirmItem.Value>{source}</SignatureConfirmItem.Value>
      </SignatureConfirmItem>
      {memo ? (
        <SignatureConfirmItem>
          <ZcashMemo text={memo.text} binaryMemos={[memo]} />
        </SignatureConfirmItem>
      ) : null}
    </>
  );
}
