import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { SizableText, Stack } from '@onekeyhq/components';
import { formatDistanceStrict } from '@onekeyhq/shared/src/utils/dateUtils';

type IProps = {
  approvalTime: number;
};

function ApprovalTimeView(props: IProps) {
  const { approvalTime } = props;

  const formattedApprovalTime = useMemo(() => {
    const now = new Date();
    const timestamp = new BigNumber(approvalTime ?? 0);

    const timestampInMs =
      timestamp.toFixed().length <= 10 ? timestamp.times(1000) : timestamp;

    return formatDistanceStrict(new Date(timestampInMs.toNumber()), now, true);
  }, [approvalTime]);

  return (
    <Stack>
      <SizableText size="$bodyMdMedium">{formattedApprovalTime}</SizableText>
    </Stack>
  );
}

export default memo(ApprovalTimeView);
