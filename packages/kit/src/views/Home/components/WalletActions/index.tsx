import { useIntl } from 'react-intl';

import type { IActionListSection, IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
  Button,
  IconButton,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';

type IProps = {
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
  onBuy: () => void;
  extraActions?: IActionListSection[];
};

function HeaderAction({
  icon,
  label,
  onPress,
  hideIcon = true,
  hideLabel = false,
}: {
  icon?: IKeyOfIcons;
  label?: string;
  onPress?: () => void;
  hideIcon?: boolean;
  hideLabel?: boolean;
}) {
  const tableLayout = useMedia().gtLg;

  if (tableLayout)
    return (
      <Button
        size="medium"
        icon={hideIcon ? undefined : icon}
        {...(!hideIcon &&
          icon && {
            pl: '$2.5',
            pr: '$0.5',
            py: '$2',
          })}
        onPress={onPress}
      >
        {hideLabel ? '' : label}
      </Button>
    );

  return (
    <YStack space="$2" alignItems="center">
      <IconButton size="large" icon={icon ?? 'DotHorOutline'} />
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
    </YStack>
  );
}

function WalletActions(props: IProps) {
  const { onBuy, onSend, onReceive, onSwap, extraActions } = props;
  const intl = useIntl();
  const tableLayout = useMedia().gtLg;
  return (
    <XStack
      space="$2"
      mt="$5"
      justifyContent={tableLayout ? 'unset' : 'space-between'}
    >
      <HeaderAction label="Buy" onPress={onBuy} icon="PlusLargeOutline" />
      <HeaderAction
        label="Receive"
        onPress={onReceive}
        icon="ArrowBottomOutline"
      />
      <HeaderAction label="Swap" onPress={onSwap} icon="SwitchHorOutline" />
      <HeaderAction
        label={intl.formatMessage({ id: 'action__send' })}
        onPress={onSend}
        icon="ArrowTopOutline"
      />

      <ActionList
        title={intl.formatMessage({ id: 'action__more' })}
        renderTrigger={
          <HeaderAction
            icon="DotHorOutline"
            label={intl.formatMessage({ id: 'action__more' })}
            hideIcon={false}
            hideLabel
          />
        }
        sections={extraActions}
      />
    </XStack>
  );
}

export { WalletActions, HeaderAction };
