import { memo } from 'react';

import { Alert } from '@onekeyhq/components';
import type { ISwapAlertState } from '@onekeyhq/shared/types/swap/types';

interface ISwapAlertContainerProps {
  alerts?: ISwapAlertState[];
}

const SwapAlertContainer = ({ alerts }: ISwapAlertContainerProps) =>
  alerts?.map((item, index) => (
    <Alert
      type="warning"
      description={item.message}
      icon="InfoCircleOutline"
      {...(index !== 0 && {
        mt: '$2.5',
      })}
    />
  ));

export default memo(SwapAlertContainer);
