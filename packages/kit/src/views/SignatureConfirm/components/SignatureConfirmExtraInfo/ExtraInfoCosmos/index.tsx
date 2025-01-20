import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import type { IDecodedTxExtraCosmos } from '@onekeyhq/core/src/chains/cosmos/types';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function TxExtraInfoCosmos({ style }: { style?: IStackProps }) {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const decodedTx = decodedTxs?.[0];

  const extraInfo = decodedTx?.extraInfo as IDecodedTxExtraCosmos;

  if (!decodedTx || !extraInfo || !extraInfo.memo) return null;

  return (
    <SignatureConfirmItem {...style}>
      <SignatureConfirmItem.Label>
        {intl.formatMessage({
          id: ETranslations.send_tag,
        })}
      </SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>{extraInfo.memo}</SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export default memo(TxExtraInfoCosmos);
