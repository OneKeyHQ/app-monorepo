import React, { FC } from 'react';

import { Center } from 'native-base';
import { ColorType } from 'native-base/lib/typescript/components/types';

import Box from '../Box';
import Divider from '../Divider';
import Icon, { ICON_NAMES } from '../Icon';
import IconButton from '../IconButton';
import PressableItem from '../Pressable/PressableItem';
import Typography, { Text } from '../Typography';

import { ContentItemBaseProps } from './Container';

export type ContentItemProps = {
  title: string;
  titleColor?: ColorType | null;
  describe?: string;
  describeColor?: ColorType | null;
  subDescribe?: string | string[] | null;
  hasArrow?: boolean;
  customArrowIconName?: ICON_NAMES;
  custom?: React.ReactNode | null;
  onPress?: (() => void) | null;
  onArrowIconPress?: (() => void) | null;
} & ContentItemBaseProps;

const defaultProps = {
  hasArrow: false,
  valueColor: null,
} as const;

const Item: FC<ContentItemProps> = ({
  title,
  titleColor,
  describe,
  describeColor,
  subDescribe,
  hasArrow,
  customArrowIconName,
  hasDivider,
  children,
  custom,
  onArrowIconPress,
}) => (
  <Box w="100%" flexDirection="column">
    <Box
      px={{ base: '4', lg: '6' }}
      py={4}
      w="100%"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
    >
      <Text
        h="100%"
        maxW="60%"
        flexWrap="wrap"
        color={titleColor ?? 'text-subdued'}
        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
      >
        {title}
      </Text>
      <Box
        flex={1}
        w="100%"
        ml={3}
        flexDirection="column"
        flexWrap="wrap"
        alignItems="flex-end"
      >
        {!!children && (
          <Box
            w="100%"
            flexWrap="wrap"
            justifyContent="flex-end"
            flexDirection="row"
          >
            {children}
          </Box>
        )}
        {!!describe && (
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            w="100%"
            flexWrap="wrap"
            color={describeColor ?? 'text-default'}
            textAlign="right"
          >
            {describe}
          </Text>
        )}
        {!!subDescribe &&
          subDescribe.length > 0 &&
          (subDescribe instanceof Array ? (
            subDescribe.map((describeItem, index) => (
              <Typography.Body2
                key={`subDescribe-${index}`}
                w="100%"
                flexWrap="wrap"
                color="text-subdued"
                textAlign="right"
              >
                {describeItem}
              </Typography.Body2>
            ))
          ) : (
            <Typography.Body2
              w="100%"
              color="text-subdued"
              flexWrap="wrap"
              textAlign="right"
            >
              {subDescribe}
            </Typography.Body2>
          ))}
        {!!custom && (
          <Box
            w="100%"
            flexWrap="wrap"
            flexDirection="row"
            justifyContent="flex-end"
          >
            {custom}
          </Box>
        )}
      </Box>
      {(hasArrow || !!customArrowIconName) && onArrowIconPress ? (
        <Center my={-1} ml={2} mr={-1}>
          <IconButton
            size="xs"
            circle
            name={customArrowIconName ?? 'ChevronRightSolid'}
            type="plain"
            onPress={onArrowIconPress}
          />
        </Center>
      ) : (
        <Box ml={3}>
          <Icon name={customArrowIconName ?? 'ChevronRightSolid'} size={20} />
        </Box>
      )}
    </Box>
    {hasDivider && <Divider />}
  </Box>
);

const ContentItem: FC<ContentItemProps> = ({ onPress, ...props }) => {
  if (onPress) {
    return (
      <PressableItem px={0} py={0} onPress={onPress}>
        <Item key="content-press-item" {...props} />
      </PressableItem>
    );
  }
  return <Item key="content-item" {...props} />;
};

ContentItem.defaultProps = defaultProps;
export default ContentItem;
