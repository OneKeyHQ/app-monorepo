import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { SizableText, Stack } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { formatDistanceStrict } from '@onekeyhq/shared/src/utils/dateUtils';

type IProps = {
  approvalTime: number;
};

function ApprovalTimeView(props: IProps) {
  const { approvalTime } = props;

  const formattedApprovalTime = useMemo(() => {
    const timestamp = new BigNumber(approvalTime ?? 0);
    if (timestamp.toFixed().length <= 10) {
      throw new OneKeyLocalError('approvalTime must be in milliseconds');
    }
    const now = new Date();
    return formatDistanceStrict(new Date(timestamp.toNumber()), now, true);
  }, [approvalTime]);

  return (
    <Stack>
      <SizableText size="$bodyMdMedium">{formattedApprovalTime}</SizableText>
    </Stack>
  );
}

export default memo(ApprovalTimeView);
