import { memo } from 'react';

import { Alert, YStack } from '@onekeyhq/components';
import type { IBorrowAlert } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

export const BorrowAlerts = memo(({ alerts }: { alerts?: IBorrowAlert[] }) => {
  if (!alerts?.length) return null;

  return (
    <YStack gap="$3">
      {alerts.map((alert, index) => (
        <Alert
          key={`${alert.title?.text ?? 'alert'}-${index}`}
          type={alert.badge}
          renderTitle={(props) => <EarnText {...props} text={alert.title} />}
          descriptionComponent={
            alert.description ? (
              <EarnText
                text={alert.description}
                size="$bodyMd"
                color="$textSubdued"
              />
            ) : null
          }
        />
      ))}
    </YStack>
  );
});

BorrowAlerts.displayName = 'BorrowAlerts';
