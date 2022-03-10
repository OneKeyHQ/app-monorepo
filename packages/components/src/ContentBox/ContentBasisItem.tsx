import React, { FC } from 'react';

import { ColorType } from 'native-base/lib/typescript/components/types';

import Box from '../Box';
import Divider from '../Divider';
import Icon from '../Icon';
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
  custom?: React.ReactNode | null;
  onPress?: (() => void) | null;
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
  hasDivider,
  children,
  custom,
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
        color={titleColor ?? 'text-subdued'}
        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
      >
        {title}
      </Text>
      <Box
        flex={1}
        ml={3}
        flexDirection="column"
        flexWrap="wrap"
        alignItems="flex-end"
      >
        {!!children && children}
        {!!describe && (
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            w="100%"
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
              <>
                <Typography.Body2
                  key={`${describeItem}-${index}`}
                  w="100%"
                  color="text-subdued"
                  textAlign="right"
                >
                  {describeItem}
                </Typography.Body2>
              </>
            ))
          ) : (
            <Typography.Body2 w="100%" color="text-subdued" textAlign="right">
              {describe}
            </Typography.Body2>
          ))}
        {!!custom && (
          <Box w="100%" mt={2} flexDirection="row" justifyContent="flex-end">
            {custom}
          </Box>
        )}
      </Box>
      {hasArrow && (
        <Box ml={3}>
          <Icon name="ChevronRightSolid" size={20} />
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
        <Item {...props} />
      </PressableItem>
    );
  }
  return <Item {...props} />;
};

ContentItem.defaultProps = defaultProps;
export default ContentItem;
