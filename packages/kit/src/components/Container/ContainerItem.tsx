import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

type IProps = {
  title?: React.ReactNode;
  content?: React.ReactNode;
  subContent?: React.ReactNode;
  contentAdd?: React.ReactNode;
  description?: {
    children?: React.ReactNode;
    icon?: IKeyOfIcons;
  };
  hasDivider?: boolean;
};

function ContainerItem(props: IProps) {
  const { title, content, subContent, contentAdd, description, hasDivider } =
    props;
  return (
    <Stack>
      <YStack width="100%" py="$3" space="$0.5">
        {typeof title === 'string' ? (
          <SizableText size="$headingSm" color="$textSubdued">
            {title}
          </SizableText>
        ) : (
          title
        )}
        <XStack alignItems="center" justifyContent="space-between">
          <XStack space="$1" alignItems="center">
            {typeof content === 'string' ? (
              <SizableText size="$bodyMdMedium" color="$text">
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
            {description?.icon && (
              <Icon color="$iconSubdued" size="$4" name={description.icon} />
            )}
            {typeof description?.children === 'string' ? (
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {description.children}
              </SizableText>
            ) : (
              description.children
            )}
          </XStack>
        )}
      </YStack>
      {hasDivider && <Divider />}
    </Stack>
  );
}

export { ContainerItem };
