import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Divider,
  Group,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

type IProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  content?: React.ReactNode;
  subContent?: React.ReactNode;
  contentAdd?: React.ReactNode;
  description?: {
    content?: React.ReactNode;
    icon?: IKeyOfIcons;
  };
  hasDivider?: boolean;
};

function ContainerItem(props: IProps) {
  const {
    title,
    subtitle,
    content,
    subContent,
    contentAdd,
    description,
    hasDivider,
  } = props;
  return (
    <Group.Item>
      <YStack px="$4" py="$3" space="$0.5">
        <XStack alignItems="center" space="$1">
          {typeof title === 'string' ? (
            <SizableText
              size="$headingSm"
              color="$textSubdued"
              numberOfLines={1}
            >
              {title}
            </SizableText>
          ) : (
            title
          )}
          {typeof subtitle === 'string' ? (
            <SizableText
              size="$headingSm"
              color="$textDisabled"
              numberOfLines={1}
            >
              {subtitle}
            </SizableText>
          ) : (
            subtitle
          )}
        </XStack>
        <XStack alignItems="center" justifyContent="space-between">
          <XStack space="$1" alignItems="center" flex={1}>
            {typeof content === 'string' ? (
              <SizableText size="$bodyMdMedium" color="$text" numberOfLines={2}>
                {content}
              </SizableText>
            ) : (
              content
            )}
            {typeof subContent === 'string' ? (
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {subContent}
              </SizableText>
            ) : (
              subContent
            )}
          </XStack>
          {contentAdd}
        </XStack>
        {description && (
          <XStack alignItems="center">
            {description.icon && (
              <Icon color="$iconSubdued" size="$4" name={description.icon} />
            )}
            {typeof description.content === 'string' ? (
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {description.content}
              </SizableText>
            ) : (
              description.content
            )}
          </XStack>
        )}
      </YStack>
      <Stack>{hasDivider && <Divider />}</Stack>
    </Group.Item>
  );
}

export { ContainerItem };
