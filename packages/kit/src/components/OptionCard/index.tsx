import { StyleSheet } from 'react-native';

import { Icon, XStack, YStack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';

import { ListItem } from '../ListItem';

import type { IListItemProps } from '../ListItem';

export type IOptionCardProps = {
  icon: IKeyOfIcons;
  title: string;
  subtitle: IListItemProps['subtitle'];
} & IListItemProps;

export function OptionCard({
  icon,
  title,
  subtitle,
  ...props
}: IOptionCardProps) {
  return (
    <ListItem
      mx="$0"
      p="$3.5"
      drillIn
      gap="$3"
      userSelect="none"
      bg="$neutral2"
      borderRadius="$3"
      hoverStyle={{ bg: '$neutral3' }}
      pressStyle={{ bg: '$neutral4' }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
      }}
      $platform-web={{
        outlineWidth: 1,
        outlineColor: '$neutral3',
        outlineStyle: 'solid',
      }}
      {...props}
    >
      <YStack bg="$neutral3" p="$2" borderRadius="$full">
        <Icon name={icon} color="$iconActive" />
      </YStack>
      <ListItem.Text gap="$1" flex={1} primary={title} secondary={subtitle} />
    </ListItem>
  );
}

const PAYMENT_ICONS: Array<{
  name: IKeyOfIcons;
  px: string;
}> = [
  { name: 'ApplePayIllus', px: '$1.5' },
  { name: 'GooglePayIllus', px: '$1.5' },
  { name: 'VisaIllus', px: '$0.5' },
];

export function PaymentMethodBadges() {
  return (
    <XStack mt="$1" gap="$1">
      {PAYMENT_ICONS.map(({ name, px }) => (
        <YStack
          key={name}
          h="$5"
          px={px}
          borderRadius="$2"
          borderCurve="continuous"
          justifyContent="center"
          alignItems="center"
          bg="$neutral3"
        >
          <Icon name={name} h="$3" w="$8" color="$icon" />
        </YStack>
      ))}
      <XStack
        alignItems="center"
        px="$1"
        gap="$0.5"
        bg="$neutral3"
        borderRadius="$2"
        borderCurve="continuous"
      >
        <YStack borderRadius="$full" w={3} h={3} bg="$iconSubdued" />
        <YStack borderRadius="$full" w={3} h={3} bg="$iconSubdued" />
        <YStack borderRadius="$full" w={3} h={3} bg="$iconSubdued" />
      </XStack>
    </XStack>
  );
}
