import { useMemo } from 'react';

import { Alert } from '@onekeyhq/components';

import type { IRiskLevel } from '../../types';

function DAppRiskyAlert({ riskLevel }: { riskLevel: IRiskLevel }) {
  const content = useMemo(() => {
    switch (riskLevel) {
      case 'Scam': {
        return 'Risky domain. Leave to secure your assets.';
      }
      case 'Unknown': {
        return 'This domain cannot be verified. Check the request carefully before approving.';
      }
      default:
        return '';
    }
  }, [riskLevel]);
  const isScamLevel = riskLevel === 'Scam';

  if (riskLevel === 'Verified') {
    return null;
  }

  return (
    <Alert
      fullBleed
      type={isScamLevel ? 'critical' : 'warning'}
      title={content}
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
