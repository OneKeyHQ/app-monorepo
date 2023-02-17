import { Button, Center, Icon, Text } from '@onekeyhq/components';
import type { IDecodedTx } from '@onekeyhq/engine/src/vaults/types';

import { useNetwork } from '../../../hooks/useNetwork';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { TxListActionBox } from '../components/TxListActionBox';

import type { ITxActionMetaIcon, ITxActionMetaTitle } from '../types';

type Props = {
  decodedTx: IDecodedTx;
  iconInfo?: ITxActionMetaIcon;
  titleInfo?: ITxActionMetaTitle;
};

function TxMoreInfo(props: Props) {
  const { titleInfo, decodedTx } = props;
  const { network } = useNetwork({ networkId: decodedTx.networkId });
  const openBlockBrowser = useOpenBlockBrowser(network);

  const canOpenTxDetail = openBlockBrowser.hasAvailable && decodedTx.txid;

  return (
    <Center>
      {canOpenTxDetail ? (
        <Button
          isDisabled={!canOpenTxDetail}
          onPress={() =>
            openBlockBrowser.openTransactionDetails(decodedTx.txid)
          }
          type="basic"
          size="base"
          rightIcon={
            <Icon
              name="ArrowTopRightOnSquareMini"
              color="icon-default"
              size={16}
            />
          }
        >
          {titleInfo?.title}
        </Button>
      ) : (
        <Text typography="Body1Strong" color="text-subdued" textAlign="center">
          {titleInfo?.title}
        </Text>
      )}
    </Center>
  );
}

function TxMoreInfoT0(props: Props) {
  const { iconInfo, titleInfo } = props;
  return <TxListActionBox iconInfo={iconInfo} titleInfo={titleInfo} />;
}

export { TxMoreInfo, TxMoreInfoT0 };
