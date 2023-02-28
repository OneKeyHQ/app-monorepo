import type { ComponentProps } from 'react';

import { Box, HStack, Text } from '@onekeyhq/components';

import { fallbackTextComponent } from '../utils/utilsTxDetail';

import type { ITxActionElementDetail } from '../types';

export function TxActionElementDetailCellTitleText(
  props: ComponentProps<typeof Text>,
) {
  return <Text typography="Body2Strong" color="text-subdued" {...props} />;
}

export function TxActionElementDetailCellContentText(
  props: ComponentProps<typeof Text>,
) {
  return <Text typography="Body2Strong" {...props} />;
}

export function TxActionElementDetailCell(props: ITxActionElementDetail) {
  const { title, content, extra } = props;
  const titleView = fallbackTextComponent(
    title,
    TxActionElementDetailCellTitleText,
  );
  const contentView = fallbackTextComponent(
    content,
    TxActionElementDetailCellContentText,
  );
  if (extra) {
    return (
      <Box>
        <HStack justifyContent="space-between" alignItems="center">
          <Box>
            {titleView}
            {contentView}
          </Box>
          <Box>{extra}</Box>
        </HStack>
      </Box>
    );
  }

  return (
    <Box>
      {titleView}
      {contentView}
    </Box>
  );
}
