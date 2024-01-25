import { useMemo } from 'react';

import { Alert } from '@onekeyhq/components';

function DAppRiskyAlert() {
  const content = useMemo(
    () => 'Risky domain. Leave to secure your assets.',
    [],
  );

  return (
    <Alert
      fullBleed
      type="critical"
      title={content}
      icon="ErrorSolid"
      action={{
        primary: 'Details',
        onPrimaryPress: () => console.log('onPrimaryPress'),
      }}
    />
  );
}

export { DAppRiskyAlert };
