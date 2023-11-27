import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';

type IProps = {
  onSend: () => void;
  onReceive: () => void;
};

function WalletActions(props: IProps) {
  const { onSend, onReceive } = props;
  const intl = useIntl();
  return (
    <XStack space="$4">
      <Button variant="primary" size="large" onPress={onSend}>
        {intl.formatMessage({ id: 'action__send' })}
      </Button>
      <Button variant="primary" size="large" onPress={onReceive}>
        {intl.formatMessage({ id: 'action__receive' })}
      </Button>
    </XStack>
  );
}

export { WalletActions };
