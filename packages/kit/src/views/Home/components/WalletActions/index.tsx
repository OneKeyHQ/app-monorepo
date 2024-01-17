import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Button, XStack } from '@onekeyhq/components';

type IProps = {
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
};

function HeaderAction({
  icon,
  label,
  onPress,
}: {
  icon?: IKeyOfIcons;
  label?: string;
  onPress?: () => void;
}) {
  return (
    <Button
      icon={icon}
      {...(icon && {
        pl: '$2.5',
        pr: '$0.5',
      })}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

function WalletActions(props: IProps) {
  const { onSend, onReceive, onSwap } = props;
  const intl = useIntl();
  return (
    <XStack space="$2" mt="$5">
      <HeaderAction
        label={intl.formatMessage({ id: 'action__send' })}
        onPress={onSend}
      />
      <HeaderAction label="Receive" onPress={onReceive} />
      <HeaderAction label="Swap" onPress={onSwap} />
      <HeaderAction icon="DotHorOutline" />
    </XStack>
  );
}

export { WalletActions, HeaderAction };
