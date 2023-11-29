import { useIntl } from 'react-intl';

import { IconButton, XStack } from '@onekeyhq/components';

type IProps = {
  onSend: () => void;
  onReceive: () => void;
};

function WalletActions(props: IProps) {
  const { onSend, onReceive } = props;
  const intl = useIntl();
  return (
    <XStack space="$4">
      <IconButton
        icon="SendSolid"
        onPress={onSend}
        title={intl.formatMessage({ id: 'action__send' })}
      />
      <IconButton
        icon="QrCodeOutline"
        onPress={onReceive}
        title={intl.formatMessage({ id: 'action__receive' })}
      />
    </XStack>
  );
}

export { WalletActions };
