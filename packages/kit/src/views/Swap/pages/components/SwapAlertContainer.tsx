import { memo, useMemo } from 'react';

import { Alert, Icon, YStack } from '@onekeyhq/components';
import type { ISwapAlertState } from '@onekeyhq/shared/types/swap/types';
import { ESwapAlertLevel } from '@onekeyhq/shared/types/swap/types';

export interface ISwapAlertContainerProps {
  alerts: ISwapAlertState[];
}

const SwapAlertContainer = ({ alerts }: ISwapAlertContainerProps) => {
  const alertsSorted = useMemo(
    () =>
      alerts?.sort((a) => {
        if (a.alertLevel === ESwapAlertLevel.ERROR) {
          return -1;
        }
        if (a.alertLevel === ESwapAlertLevel.INFO) {
          return 0;
        }
        return 1;
      }),
    [alerts],
  );

  if (alertsSorted?.some((item) => item.alertLevel === ESwapAlertLevel.ERROR)) {
    return (
      <YStack gap="$2.5">
        {alertsSorted
          .filter((item) => item.alertLevel === ESwapAlertLevel.ERROR)
          .reverse()
          .map((item, index) => {
            const { message } = item;
            return <Alert key={index} type="critical" description={message} />;
          })}
      </YStack>
    );
  }
  return (
    <YStack gap="$2.5">
      {alertsSorted?.map((item, index) => {
        const { message, alertLevel,title,icon } = item;
        return (
          <Alert
            key={index}
            type={
              alertLevel === ESwapAlertLevel.WARNING ? 'warning' : 'default'
            }
            title={title}
            description={message}
            icon={icon}
          />
        );
      }) ?? null}
    </YStack>
  );
};

export default memo(SwapAlertContainer);
