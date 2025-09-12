import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps, IYStackProps } from '@onekeyhq/components';
import type { IDecodedTxExtraSol } from '@onekeyhq/core/src/chains/sol/types';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function TxExtraInfoSol({ style }: { style?: IStackProps }) {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const decodedTx = decodedTxs?.[0];

  const extraInfo = decodedTx?.extraInfo as IDecodedTxExtraSol;

  if (!decodedTx || !extraInfo || !extraInfo.createTokenAccountFee) return null;

  return (
    <SignatureConfirmItem {...(style as IYStackProps)}>
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
