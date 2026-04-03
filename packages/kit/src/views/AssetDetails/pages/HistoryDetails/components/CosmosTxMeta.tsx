import { useIntl } from 'react-intl';

import type { IDecodedTxExtraCosmos } from '@onekeyhq/core/src/chains/cosmos/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function CosmosTxAttributes({ decodedTx }: { decodedTx: IDecodedTx }) {
  const intl = useIntl();
  const cosmosExtraInfo = decodedTx.extraInfo as IDecodedTxExtraCosmos;

  if (!cosmosExtraInfo?.memo) return null;

  return (
    <>
      <InfoItem
        label={intl.formatMessage({
          id: ETranslations.send_tag_placeholder,
        })}
        renderContent={cosmosExtraInfo.memo}
      />
    </>
  );
}

export { CosmosTxAttributes };
