import type { IKeyOfIcons, IStackProps } from '@onekeyhq/components';
import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';

export interface ITutorialsListItemProps {
  title?: string;
  description?: string;
  iconName?: IKeyOfIcons;
}

interface ITutorialsProps {
  list: ITutorialsListItemProps[];
}

export function Tutorials({ list, ...rest }: ITutorialsProps & IStackProps) {
  return (
    <Stack mt="$10" {...rest}>
      {list.map(({ title, description, iconName }, index) => (
        <XStack
          key={title}
          {...(index !== 0 && {
            mt: '$5',
          })}
        >
          {iconName && (
            <Stack px="$0.5" mr="$4">
              <Icon
                name={iconName}
                flexShrink={0}
                color="$iconSubdued"
                size="$5"
              />
            </Stack>
          )}
          <Stack flex={1}>
            <SizableText size="$bodyMd">{title}</SizableText>
            <SizableText size="$bodyMd" mt="$1" color="$textSubdued">
              {description}
            </SizableText>
          </Stack>
        </XStack>
      ))}
    </Stack>
  );
}
