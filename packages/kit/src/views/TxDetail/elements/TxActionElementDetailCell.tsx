import React, { ComponentProps } from 'react';

import { Box, Text } from '@onekeyhq/components';

import { ITxActionElementDetail } from '../types';

export function TxActionElementDetailCellContentText(
  props: ComponentProps<typeof Text>,
) {
  return <Text typography="Body1Strong" {...props} />;
}

export function TxActionElementDetailCell(props: ITxActionElementDetail) {
  const { title, content } = props;
  let contentView = content;
  if (typeof content === 'string') {
    contentView = (
      <TxActionElementDetailCellContentText>
        {content}
      </TxActionElementDetailCellContentText>
    );
  }
  return (
    <Box>
      <Text typography="Body1Strong" color="text-subdued">
        {title}
      </Text>
      {contentView}
    </Box>
  );
}
