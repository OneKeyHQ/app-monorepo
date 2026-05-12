import { useIntl } from 'react-intl';

import type { IDecodedTxExtraStellar } from '@onekeyhq/core/src/chains/stellar/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function StellarTxAttributes({ decodedTx }: { decodedTx: IDecodedTx }) {
  const intl = useIntl();
  const stellarExtraInfo = decodedTx.extraInfo as IDecodedTxExtraStellar;

  if (!stellarExtraInfo?.memo) return null;

  return (
    <>
      <InfoItem
        label={intl.formatMessage({
          id: ETranslations.send_tag_placeholder,
        })}
        renderContent={stellarExtraInfo.memo}
      />
    </>
  );
}

export { StellarTxAttributes };
