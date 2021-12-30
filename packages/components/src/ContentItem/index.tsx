import React, { FC } from 'react';

import Box from '../Box';
import Divider from '../Divider';
import Typography from '../Typography';

export type ContentItemProps = {
  title: string;
  value?: string;
  describe?: string;
  hasDivider?: boolean;
  children?: JSX.Element;
};

const ContentItem: FC<ContentItemProps> = ({
  title,
  value,
  describe,
  hasDivider,
  children,
}) => (
  <Box w="100%" flexDirection="column">
    <Box
      p={4}
      w="100%"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
    >
      <Typography.Body1 h="100%" color="text-subdued">
        {title}
      </Typography.Body1>
      <Box flex={1} ml={3} flexDirection="column" alignItems="flex-end">
        {!!children && children}
        {!!value && (
          <Typography.Body1 color="text-default" textAlign="right">
            {value}
          </Typography.Body1>
        )}
        {!!describe && (
          <Typography.Body2 color="text-subdued" textAlign="right">
            {describe}
          </Typography.Body2>
        )}
      </Box>
    </Box>
    {hasDivider && <Divider />}
  </Box>
);

export default ContentItem;
