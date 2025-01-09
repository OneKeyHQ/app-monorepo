import type { IUnsignedTx } from '@onekeyhq/core/src/types';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { InfoItemGroup } from '@onekeyhq/kit/src/views/AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';

import { getTxSpecialInfo } from './TxSpecialInfo';

type IProps = {
  accountId: string;
  networkId: string;
  unsignedTxs: IUnsignedTx[];
};

function TxSpecialInfoContainer(props: IProps) {
  const { accountId, networkId, unsignedTxs } = props;
  const { network } = useAccountData({ networkId });
  const TxSpecialInfo = getTxSpecialInfo({ impl: network?.impl ?? '' });

  if (TxSpecialInfo) {
    return (
      <InfoItemGroup pt={0} mt="$-2.5">
        <TxSpecialInfo
          accountId={accountId}
          networkId={networkId}
          unsignedTxs={unsignedTxs}
        />
      </InfoItemGroup>
    );
  }

  return null;
}

export { TxSpecialInfoContainer };
