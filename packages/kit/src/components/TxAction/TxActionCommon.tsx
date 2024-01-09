import { isString } from 'lodash';

import { Icon, Image, Text, XStack, YStack } from '@onekeyhq/components';

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
          <Image size="$8" circular>
            <Image.Source src={icon} />
            <Image.Fallback>
              <Icon name="ImageMountainSolid" size="$8" />
            </Image.Fallback>
          </Image>
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
