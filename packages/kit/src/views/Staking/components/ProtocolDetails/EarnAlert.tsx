import { Alert, YStack } from '@onekeyhq/components';
import type { IEarnAlert, IEarnText } from '@onekeyhq/shared/types/staking';

import { EarnText } from './EarnText';

export function EarnAlert({ alerts }: { alerts?: IEarnAlert[] }) {
  if (alerts?.length) {
    return (
      <YStack gap="$1.5" py="$1.5">
        {alerts.map((alertItem, index) => {
          return (
            <Alert
              key={`${alertItem.alert}-${index}`}
              type={alertItem.badge}
              renderTitle={(props) => {
                return (
                  <EarnText
                    {...props}
                    text={
                      typeof alertItem.alert === 'string'
                        ? { text: alertItem.alert }
                        : (alertItem.alert as IEarnText)
                    }
                  />
                );
              }}
            />
          );
        })}
      </YStack>
    );
  }
  return null;
}
