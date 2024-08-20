import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDecodedTxExtraAlgo } from '@onekeyhq/core/src/chains/algo/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function AlgoTxAttributes({ decodedTx }: { decodedTx: IDecodedTx }) {
  const intl = useIntl();
  const algoExtraInfo = decodedTx.extraInfo as IDecodedTxExtraAlgo;

  if (!algoExtraInfo) return null;

  return (
    <>
      {!isNil(algoExtraInfo?.note) ? (
        <InfoItem
          label={intl.formatMessage({
            id: ETranslations.global_Note,
          })}
          renderContent={`${algoExtraInfo.note}(${Buffer.from(
            algoExtraInfo.note,
          ).toString('base64')})`}
        />
      ) : null}
    </>
  );
}

export { AlgoTxAttributes };
