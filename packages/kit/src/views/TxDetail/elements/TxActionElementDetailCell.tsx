import type { ComponentProps } from 'react';

import { Box, Text } from '@onekeyhq/components';

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
  const { title, content } = props;
  const titleView = fallbackTextComponent(
    title,
    TxActionElementDetailCellTitleText,
  );
  const contentView = fallbackTextComponent(
    content,
    TxActionElementDetailCellContentText,
  );
  return (
    <Box>
      {titleView}
      {contentView}
    </Box>
  );
}
