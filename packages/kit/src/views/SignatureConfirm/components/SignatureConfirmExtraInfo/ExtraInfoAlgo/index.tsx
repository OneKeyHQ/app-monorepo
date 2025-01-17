import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import type { IDecodedTxExtraAlgo } from '@onekeyhq/core/src/chains/algo/types';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function TxExtraInfoAlgo({ style }: { style?: IStackProps }) {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const decodedTx = decodedTxs?.[0];

  const extraInfo = decodedTx?.extraInfo as IDecodedTxExtraAlgo;

  if (!decodedTx || !extraInfo || !extraInfo.note) return null;

  return (
    <SignatureConfirmItem {...style}>
      <SignatureConfirmItem.Label>
        {intl.formatMessage({
          id: ETranslations.global_Note,
        })}
      </SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>{extraInfo.note}</SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export default memo(TxExtraInfoAlgo);
