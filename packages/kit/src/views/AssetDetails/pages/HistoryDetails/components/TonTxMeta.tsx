import { useIntl } from 'react-intl';

import type { IDecodedTxExtraTon } from '@onekeyhq/core/src/chains/ton/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function TonTxAttributes({ decodedTx }: { decodedTx: IDecodedTx }) {
  const intl = useIntl();
  const tonExtraInfo = decodedTx.extraInfo as IDecodedTxExtraTon;

  if (!tonExtraInfo?.memo) return null;

  return (
    <>
      <InfoItem
        label={intl.formatMessage({
          id: ETranslations.send_tag_placeholder,
        })}
        renderContent={tonExtraInfo.memo}
      />
    </>
  );
}

export { TonTxAttributes };
