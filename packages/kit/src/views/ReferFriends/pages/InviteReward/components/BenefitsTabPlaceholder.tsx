import { Empty, YStack } from '@onekeyhq/components';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

export function BenefitsTabPlaceholder() {
  return (
    <YStack
      testID={ReferFriendsTestIDs.benefitsPlaceholder}
      flex={1}
      px="$pagePadding"
      py="$10"
    >
      <Empty
        icon="GiftOutline"
        title={INVITE_COPY.benefitsEmptyTitle}
        description={INVITE_COPY.benefitsEmptyDescription}
      />
    </YStack>
  );
}
