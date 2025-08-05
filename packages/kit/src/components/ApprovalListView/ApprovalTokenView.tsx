import { memo } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';

type IProps = {
  approvedTokenNumber: number;
};

function ApprovalTokenView(props: IProps) {
  const { approvedTokenNumber } = props;

  return (
    <Stack>
      <SizableText size="$bodyMdMedium">{approvedTokenNumber}</SizableText>
    </Stack>
  );
}

export default memo(ApprovalTokenView);
