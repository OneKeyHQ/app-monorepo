import { SegmentControl } from '@onekeyhq/components';
import { SimpleTabs } from '@onekeyhq/kit/src/views/ReferFriends/components';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';
import {
  EReferralPageTab,
  type IReferralPageTab,
  resolveReferralPageTab,
} from '../referralPageTab';

const TABS = [
  {
    value: EReferralPageTab.invite,
    label: INVITE_COPY.inviteTab,
    testID: ReferFriendsTestIDs.inviteTab,
  },
  {
    value: EReferralPageTab.benefits,
    label: INVITE_COPY.benefitsTab,
    testID: ReferFriendsTestIDs.benefitsTab,
  },
];

export function ReferralJobTabs({
  value,
  onChange,
  segmented = false,
}: {
  value: IReferralPageTab;
  onChange: (value: IReferralPageTab) => void;
  // Segmented style fits the navigation bar title slot on compact layouts.
  segmented?: boolean;
}) {
  if (segmented) {
    return (
      <SegmentControl
        w={200}
        value={value}
        options={TABS}
        onChange={(next) => {
          onChange(resolveReferralPageTab(String(next)));
        }}
      />
    );
  }

  return <SimpleTabs value={value} onChange={onChange} tabs={TABS} />;
}
