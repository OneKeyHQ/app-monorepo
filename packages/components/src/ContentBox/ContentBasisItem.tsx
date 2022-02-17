import React, { FC } from 'react';

import Box from '../Box';
import Divider from '../Divider';
import Typography, { Text } from '../Typography';

import { ContentItemBaseProps } from './Container';

export type ContentItemProps = {
  title: string;
  value?: string;
  describe?: string | string[] | null;
} & ContentItemBaseProps;

const ContentItem: FC<ContentItemProps> = ({
  title,
  value,
  describe,
  hasDivider,
  children,
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
        color="text-subdued"
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
        {!!value && (
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            w="100%"
            color="text-default"
            textAlign="right"
          >
            {value}
          </Text>
        )}
        {!!describe &&
          describe.length > 0 &&
          (describe instanceof Array ? (
            describe.map((describeItem) => (
              <>
                <Typography.Body2
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
      </Box>
    </Box>
    {hasDivider && <Divider />}
  </Box>
);

export default ContentItem;
