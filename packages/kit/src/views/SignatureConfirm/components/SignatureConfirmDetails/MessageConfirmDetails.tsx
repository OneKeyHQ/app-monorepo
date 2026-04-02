import { memo } from 'react';

import type { IDisplayComponent } from '@onekeyhq/shared/types/signatureConfirm';

import SignatureConfirmDetails from './SignatureConfirmDetails';

interface IProps {
  accountId: string;
  networkId: string;
  displayComponents: IDisplayComponent[];
}

function MessageConfirmDetails(props: IProps) {
  const { accountId, networkId, displayComponents } = props;

  return (
    <SignatureConfirmDetails
      accountId={accountId}
      networkId={networkId}
      displayComponents={displayComponents.map((component) => ({
        component,
      }))}
    />
  );
}

export default memo(MessageConfirmDetails);
