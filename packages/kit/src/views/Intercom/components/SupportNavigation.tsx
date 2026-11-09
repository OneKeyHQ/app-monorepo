import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function SupportNavigation({
  home,
  unread,
  onHome,
  onMessages,
  homeLabel,
  messagesLabel,
}: {
  home: boolean;
  unread: number;
  onHome: () => void;
  onMessages: () => void;
  homeLabel?: string;
  messagesLabel?: string;
}) {
  const intl = useIntl();
  const items: {
    id: string;
    label: string;
    icon: IIconProps['name'];
    selected: boolean;
    onPress: () => void;
    badge?: number;
  }[] = [
    {
      id: 'support-home',
      label: homeLabel || intl.formatMessage({ id: ETranslations.global_home }),
      icon: home ? 'HomeSimpleSolid' : 'HomeSimpleOutline',
      selected: home,
      onPress: onHome,
    },
    {
      id: 'support-message-history',
      label: messagesLabel || '',
      icon: home ? 'MessageTextOutline' : 'MessageTextSolid',
      selected: !home,
      onPress: onMessages,
      badge: unread,
    },
  ];
  return (
    <XStack
      testID="support-navigation"
      bg="$bgApp"
      borderTopWidth={1}
      borderTopColor="$borderSubdued"
      px="$2"
      py="$2"
    >
      {items.map((item) => (
        <YStack
          key={item.id}
          testID={item.id}
          role="button"
          aria-current={item.selected ? 'page' : undefined}
          accessibilityState={{ selected: item.selected }}
          accessibilityLabel={`${item.label}${item.badge ? ` (${item.badge})` : ''}`}
          flex={1}
          minHeight={56}
          alignItems="center"
          justifyContent="center"
          gap="$2"
          borderRadius="$2"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={item.onPress}
        >
          <XStack>
            <Icon
              name={item.icon}
              size="$6"
              color={item.selected ? '$icon' : '$iconSubdued'}
            />
            {item.badge ? (
              <YStack
                position="absolute"
                top={-2}
                right={-5}
                width={8}
                height={8}
                borderRadius={4}
                bg="$bgCritical"
              />
            ) : null}
          </XStack>
          <SizableText
            size={item.selected ? '$bodyMdMedium' : '$bodyMd'}
            color={item.selected ? '$text' : '$textSubdued'}
          >
            {item.label}
          </SizableText>
        </YStack>
      ))}
    </XStack>
  );
}
