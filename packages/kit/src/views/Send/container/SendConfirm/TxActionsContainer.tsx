import { Text } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';

import { Container } from '../../components/Container';

type IProps = {
  unsignedTxs: IUnsignedTxPro[];
  transfersInfo: ITransferInfo[];
};

function TxActionsContainer(props: IProps) {
  const { transfersInfo } = props;
  const transferInfo = transfersInfo[0];
  return (
    <Container.Box title="Action">
      <Container.Item>
        <Text>From</Text>
      </Container.Item>
      <Container.Item>
        <Text>{transferInfo.from}</Text>
      </Container.Item>
      <Container.Item>
        <Text>To</Text>
      </Container.Item>
      <Container.Item>
        <Text>{transferInfo.to}</Text>
      </Container.Item>
      <Container.Item>
        <Text>Amount</Text>
      </Container.Item>
      <Container.Item>
        <Text>{transferInfo.amount}</Text>
      </Container.Item>
    </Container.Box>
  );
}

export { TxActionsContainer };
