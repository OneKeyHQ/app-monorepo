import { isString } from 'lodash';

import { Avatar, Icon, Text, XStack, YStack } from '@onekeyhq/components';

export function TxActionCommonT1(props: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  content?: React.ReactNode;
  description?: React.ReactNode;
}) {
  const { title, icon, content, description } = props;
  return (
    <YStack space="$1" px="$4" py="$3">
      {isString(title) ? (
        <Text variant="$bodyMd" color="$textSubdued">
          {title}
        </Text>
      ) : (
        title
      )}
      <XStack space="$2" alignItems="center">
        {isString(icon) ? (
          <Avatar size="$8" circular>
            <Avatar.Image src={icon} />
            <Avatar.Fallback>
              <Icon name="ImageMountainSolid" size="$8" />
            </Avatar.Fallback>
          </Avatar>
        ) : (
          icon
        )}
        {isString(content) ? (
          <Text variant="$headingXl">{content}</Text>
        ) : (
          content
        )}
      </XStack>
      {isString(description) ? (
        <Text variant="$bodyMd" color="$textSubdued">
          {description}
        </Text>
      ) : (
        description
      )}
    </YStack>
  );
}
