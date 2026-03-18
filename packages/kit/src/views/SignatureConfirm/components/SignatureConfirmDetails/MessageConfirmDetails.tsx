import { memo } from 'react';

import type { IRiskCheckItem } from '@onekeyhq/kit/src/components/RiskDetectionCard';
import type { IDisplayComponent } from '@onekeyhq/shared/types/signatureConfirm';

import SignatureConfirmDetails from './SignatureConfirmDetails';

interface IProps {
  accountId: string;
  networkId: string;
  displayComponents: IDisplayComponent[];
  riskChecks?: IRiskCheckItem[];
}

function MessageConfirmDetails(props: IProps) {
  const { accountId, networkId, displayComponents, riskChecks } = props;

  return (
    <SignatureConfirmDetails
      accountId={accountId}
      networkId={networkId}
      displayComponents={displayComponents.map((component) => ({
        component,
      }))}
      riskChecks={riskChecks}
    />
  );
}

export default memo(MessageConfirmDetails);
