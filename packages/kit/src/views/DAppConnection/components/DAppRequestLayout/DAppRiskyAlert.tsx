import { useMemo } from 'react';

import { Alert } from '@onekeyhq/components';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';

function DAppRiskyAlert({
  urlSecurityInfo,
}: {
  urlSecurityInfo?: IHostSecurity;
}) {
  const isScamLevel = urlSecurityInfo?.level === 'high';

  if (!urlSecurityInfo?.alert) {
    return null;
  }

  return (
    <Alert
      fullBleed
      type={isScamLevel ? 'critical' : 'warning'}
      title={urlSecurityInfo.alert}
      icon={isScamLevel ? 'ErrorSolid' : 'InfoSquareSolid'}
      action={{
        primary: 'Details',
        onPrimaryPress: () => console.log('onPrimaryPress'),
      }}
      borderTopWidth={0}
    />
  );
}

export { DAppRiskyAlert };
