import { ComponentProps } from 'react';

import { Box, Text } from '@onekeyhq/components';

import { ITxActionElementDetail } from '../types';
import { fallbackTextComponent } from '../utils/utilsTxDetail';

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
