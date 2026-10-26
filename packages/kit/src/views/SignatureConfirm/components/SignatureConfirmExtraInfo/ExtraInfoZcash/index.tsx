import { useIntl } from 'react-intl';

import { ZcashMemo } from '@onekeyhq/kit/src/components/ZcashMemo';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getZcashMemoDisplay } from '@onekeyhq/shared/src/utils/zcashMemo';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

import { getZcashConfirmFrom, getZcashEncodedTx } from './zcashConfirmDisplay';

export default function TxExtraInfoZcash() {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const decodedTx = decodedTxs?.[0];
  const tx = getZcashEncodedTx(decodedTx?.encodedTx);
  if (!decodedTx || !tx) return null;
  const accountRow = decodedTx.txDisplay?.components.find(
    (component) => component.type === EParseTxComponentType.Address,
  );
  const from = getZcashConfirmFrom(
    tx,
    decodedTx.isLocalParsed &&
      accountRow?.type === EParseTxComponentType.Address &&
      accountRow.address === decodedTx.signer
      ? accountRow.address
      : undefined,
  );
  const memo = tx.zcashMemoHex
    ? getZcashMemoDisplay(tx.zcashMemoHex)
    : undefined;
  return (
    <>
      {from ? (
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
            <SignatureConfirmItem.Value>
              {from.label}
            </SignatureConfirmItem.Value>
          )}
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
