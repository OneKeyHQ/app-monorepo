import { memo } from 'react';

import { Alert } from '@onekeyhq/components';
import {
  ESwapAlertLevel,
  type ISwapAlertState,
} from '@onekeyhq/shared/types/swap/types';

interface ISwapAlertContainerProps {
  alerts?: ISwapAlertState[];
}

const SwapAlertContainer = ({ alerts }: ISwapAlertContainerProps) => {
  const alertsSorted = alerts?.sort((a) => {
    if (a.alertLevel === ESwapAlertLevel.ERROR) {
      return -1;
    }
    if (a.alertLevel === ESwapAlertLevel.INFO) {
      return 0;
    }
    return 1;
  });
  if (alertsSorted?.some((item) => item.alertLevel === ESwapAlertLevel.ERROR)) {
    return alertsSorted
      .filter((item) => item.alertLevel === ESwapAlertLevel.ERROR)
      .reverse()
      .map((item, index) => {
        const { message } = item;
        return (
          <Alert
            key={index}
            type="critical"
            description={message}
            {...(index !== 0 && {
              mt: '$2.5',
            })}
          />
        );
      });
  }
  return alertsSorted?.map((item, index) => {
    const { message, alertLevel } = item;
    return (
      <Alert
        key={index}
        type={alertLevel === ESwapAlertLevel.WARNING ? 'warning' : 'default'}
        description={message}
        {...(index !== 0 && {
          mt: '$2.5',
        })}
      />
    );
  });
};

export default memo(SwapAlertContainer);
