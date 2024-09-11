import { useIntl } from 'react-intl';

import type { IDecodedTxExtraXrp } from '@onekeyhq/core/src/chains/xrp/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function XrpTxAttributes({ decodedTx }: { decodedTx: IDecodedTx }) {
  const intl = useIntl();
  const xrpExtraInfo = decodedTx.extraInfo as IDecodedTxExtraXrp;

  if (!xrpExtraInfo) return null;

  return (
    <>
      {xrpExtraInfo?.ledgerIndex ? (
        <InfoItem
          label={intl.formatMessage({
            id: ETranslations.wallet_ledger_index,
          })}
          renderContent={`${xrpExtraInfo.ledgerIndex}`}
        />
      ) : null}
      {xrpExtraInfo?.lastLedgerSequence ? (
        <InfoItem
          label={intl.formatMessage({
            id: ETranslations.wallet_last_ledger_sequence,
          })}
          renderContent={`${xrpExtraInfo.lastLedgerSequence}`}
        />
      ) : null}
      {xrpExtraInfo?.destinationTag ? (
        <InfoItem
          label={intl.formatMessage({
            id: ETranslations.wallet_destination_tag,
          })}
          renderContent={`${xrpExtraInfo.destinationTag}`}
        />
      ) : null}
    </>
  );
}

export { XrpTxAttributes };
