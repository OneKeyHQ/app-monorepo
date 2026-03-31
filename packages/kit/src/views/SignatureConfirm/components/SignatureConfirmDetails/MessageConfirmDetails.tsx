import { memo } from 'react';

import { YStack } from '@onekeyhq/components';
import type { IDisplayComponent } from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmTestIDs } from '../../testIDs';

import SignatureConfirmDetails from './SignatureConfirmDetails';

interface IProps {
  accountId: string;
  networkId: string;
  displayComponents: IDisplayComponent[];
}

function MessageConfirmDetails(props: IProps) {
  const { accountId, networkId, displayComponents } = props;

  return (
    <YStack testID={SignatureConfirmTestIDs.MessageConfirmDetails}>
      <SignatureConfirmDetails
        accountId={accountId}
        networkId={networkId}
        displayComponents={displayComponents.map((component) => ({
          component,
        }))}
      />
    </YStack>
  );
}

export default memo(MessageConfirmDetails);
