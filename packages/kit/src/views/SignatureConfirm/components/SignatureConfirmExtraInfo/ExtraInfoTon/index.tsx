import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import type { IDecodedTxExtraTon } from '@onekeyhq/core/src/chains/ton/types';
import { useDecodedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function TxExtraInfoTon({ style }: { style?: IStackProps }) {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const decodedTx = decodedTxs?.[0];

  const extraInfo = decodedTx?.extraInfo as IDecodedTxExtraTon;

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

export default memo(TxExtraInfoTon);
