import { useIntl } from 'react-intl';

import { ZcashMemo } from '@onekeyhq/kit/src/components/ZcashMemo';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getZcashMemoDisplay } from '@onekeyhq/shared/src/utils/zcashMemo';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

import { getZcashConfirmFrom, getZcashEncodedTx } from './zcashConfirmDisplay';

export default function TxExtraInfoZcash() {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const tx = getZcashEncodedTx(decodedTxs?.[0]?.encodedTx);
  if (!tx) return null;
  const from = getZcashConfirmFrom(tx);
  const memo = tx.zcashMemoHex
    ? getZcashMemoDisplay(tx.zcashMemoHex)
    : undefined;
  return (
    <>
      <SignatureConfirmItem>
        <SignatureConfirmItem.Label>
          {intl.formatMessage({ id: ETranslations.global_from })}
        </SignatureConfirmItem.Label>
        {from.kind === 'addresses' ? (
          from.addresses.map((address) => (
            <SignatureConfirmItem.Value
              key={address}
              style={{ wordBreak: 'break-all' }}
              fontFamily="$monoMedium"
            >
              {address}
            </SignatureConfirmItem.Value>
          ))
        ) : (
          <SignatureConfirmItem.Value>{from.label}</SignatureConfirmItem.Value>
        )}
      </SignatureConfirmItem>
      {memo ? (
        <SignatureConfirmItem>
          <ZcashMemo text={memo.text} binaryMemos={[memo]} />
        </SignatureConfirmItem>
      ) : null}
    </>
  );
}
