import { memo } from 'react';

import type { IAlertType } from '@onekeyhq/components';
import { Alert } from '@onekeyhq/components';
import {
  ESwapAlertLevel,
  type ISwapAlertState,
} from '@onekeyhq/shared/types/swap/types';

interface ISwapAlertContainerProps {
  alerts?: ISwapAlertState[];
}

const SwapAlertContainer = ({ alerts }: ISwapAlertContainerProps) =>
  alerts
    ?.sort((a) => {
      if (a.alertLevel === ESwapAlertLevel.ERROR) {
        return -1;
      }
      if (a.alertLevel === ESwapAlertLevel.WARNING) {
        return 0;
      }
      return 1;
    })
    ?.map((item, index) => {
      const { alertLevel, message } = item;
      let alertType = 'info';
      if (alertLevel === ESwapAlertLevel.ERROR) {
        alertType = 'critical';
      }
      if (alertLevel === ESwapAlertLevel.WARNING) {
        alertType = 'warning';
      }
      return (
        <Alert
          type={alertType as IAlertType}
          description={message}
          icon="InfoCircleOutline"
          {...(index !== 0 && {
            mt: '$2.5',
          })}
        />
      );
    });

export default memo(SwapAlertContainer);
