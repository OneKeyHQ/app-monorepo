import { SizableText, XStack } from '@onekeyhq/components';

interface ITabButtonProps {
  label: string;
  count: number;
  isActive: boolean;
  onPress: () => void;
}

export function TabButton({
  label,
  count,
  isActive,
  onPress,
}: ITabButtonProps) {
  return (
    <XStack
      px="$2"
      py="$1"
      borderRadius="$2"
      bg={isActive ? '$bgApp' : 'transparent'}
      onPress={onPress}
      cursor="pointer"
      ai="center"
      gap="$1"
      {...(isActive && {
        shadowColor: '$shadowColor',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.09,
        shadowRadius: 3,
      })}
    >
      <SizableText
        size="$bodyMdMedium"
        color={isActive ? '$text' : '$textSubdued'}
      >
        {label}
      </SizableText>
      <XStack
        bg="$bgStrong"
        px="$2"
        py="$0.5"
        borderRadius="$2.5"
        ai="center"
        jc="center"
        minWidth="$4"
      >
        <SizableText size="$bodySm" color="$textSubdued">
          {count}
        </SizableText>
      </XStack>
    </XStack>
  );
}
