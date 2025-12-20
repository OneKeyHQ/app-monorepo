import type { IXStackProps } from '@onekeyhq/components';
import { SizableText, XStack } from '@onekeyhq/components';

export interface ISimpleTabsProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  tabs: Array<{
    value: T;
    label: string;
  }>;
  containerStyle?: IXStackProps;
}

export function SimpleTabs<T extends string = string>({
  value,
  onChange,
  tabs,
  containerStyle,
}: ISimpleTabsProps<T>) {
  return (
    <XStack gap="$0" {...containerStyle}>
      {tabs.map((tab) => {
        const isFocused = value === tab.value;

        return (
          <XStack
            key={tab.value}
            px="$2"
            py="$1.5"
            mr="$1"
            bg={isFocused ? '$bgActive' : '$bg'}
            borderRadius="$2"
            borderCurve="continuous"
            cursor="pointer"
            onPress={() => onChange(tab.value)}
            hoverStyle={{
              bg: isFocused ? '$bgActive' : '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
          >
            <SizableText
              size="$bodyMdMedium"
              color={isFocused ? '$text' : '$textSubdued'}
              letterSpacing={-0.15}
            >
              {tab.label}
            </SizableText>
          </XStack>
        );
      })}
    </XStack>
  );
}
