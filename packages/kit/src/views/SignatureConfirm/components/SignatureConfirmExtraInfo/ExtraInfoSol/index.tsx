import { memo } from 'react';

import type { IDecodedTxExtraSol } from '@onekeyhq/core/src/chains/sol/types';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';
import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function TxExtraInfoSol() {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const decodedTx = decodedTxs?.[0];

  const extraInfo = decodedTx?.extraInfo as IDecodedTxExtraSol;

  if (!decodedTx || !extraInfo || !extraInfo.createTokenAccountFee) return null;

  return (
    <SignatureConfirmItem>
      <SignatureConfirmItem.Label>
        {intl.formatMessage({
          id: ETranslations.sig_account_rent_label,
        })}
      </SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>
        {`${extraInfo.createTokenAccountFee.amount} ${extraInfo.createTokenAccountFee.symbol}`}
      </SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export default memo(TxExtraInfoSol);
