import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnChainHistoryTx } from '@onekeyhq/shared/types/history';
import { type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { InfoItem } from './TxDetailsInfoItem';

function TronAttributes({
  txDetails,
}: {
  decodedTx: IDecodedTx;
  txDetails?: IOnChainHistoryTx;
}) {
  const intl = useIntl();

  const totalNetUsage = useMemo(() => {
    const netUsage = txDetails?.receipt?.netUsage;
    const netFee = txDetails?.receipt?.netFee;
    const netFeeCost = txDetails?.receipt?.netFeeCost;

    if (
      !isNil(netFee) &&
      !isNil(netFeeCost) &&
      new BigNumber(netFee).isGreaterThan(0) &&
      new BigNumber(netFeeCost).isGreaterThan(0)
    ) {
      return new BigNumber(netFee).div(netFeeCost).toFixed();
    }

    if (!isNil(netUsage)) {
      return netUsage;
    }

    return '0';
  }, [txDetails?.receipt]);

  return (
    <>
      {txDetails && txDetails.receipt ? (
        <InfoItem
          label={intl.formatMessage({ id: ETranslations.global_resources })}
          renderContent={intl.formatMessage(
            {
              id: ETranslations.global_energy_bandwidth_num,
            },
            {
              num_1: txDetails.receipt.energyUsageTotal ?? '0',
              num_2: totalNetUsage,
            },
          )}
        />
      ) : null}
    </>
  );
}

export { TronAttributes };
