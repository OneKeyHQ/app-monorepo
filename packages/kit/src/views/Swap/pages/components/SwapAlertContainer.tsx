import { memo } from 'react';

import { Alert } from '@onekeyhq/components';
import type { ISwapAlertState } from '@onekeyhq/shared/types/swap/types';

interface ISwapAlertContainerProps {
  alerts?: ISwapAlertState[];
}

const SwapAlertContainer = ({ alerts }: ISwapAlertContainerProps) =>
  alerts?.map((item) => (
    <Alert type="warning" description={item.message} icon="InfoCircleOutline" />
  ));

export default memo(SwapAlertContainer);
