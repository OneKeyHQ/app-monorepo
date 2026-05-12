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

  // gap="$5" mirrors the parent YStack's spacing so the detail rows keep the
  // same vertical rhythm they had before, when they flowed as direct children
  // of the parent — the wrapper here is only for testID.
  return (
    <YStack gap="$5" testID={SignatureConfirmTestIDs.MessageConfirmDetails}>
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
