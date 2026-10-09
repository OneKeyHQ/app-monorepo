import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { SimpleTabs } from '@onekeyhq/kit/src/views/ReferFriends/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';
import {
  EReferralPageTab,
  type IReferralPageTab,
  IS_BENEFITS_TAB_ENABLED,
} from '../referralPageTab';

function useReferralTabs() {
  const intl = useIntl();
  return useMemo(
    () => [
      {
        value: EReferralPageTab.invite,
        label: intl.formatMessage({ id: ETranslations.sidebar_refer_a_friend }),
        testID: ReferFriendsTestIDs.inviteTab,
      },
      {
        value: EReferralPageTab.benefits,
        label: INVITE_COPY.benefitsTab,
        testID: ReferFriendsTestIDs.benefitsTab,
      },
    ],
    [intl],
  );
}

export function ReferralJobTabs({
  value,
  onChange,
  variant = 'tabs',
}: {
  value: IReferralPageTab;
  onChange: (value: IReferralPageTab) => void;
  // `title`: compact layouts title the page with the tab names themselves,
  // at heading size; the active one reads in full color. Until the benefits
  // tab ships it is a plain page title.
  variant?: 'tabs' | 'title';
}) {
  const tabs = useReferralTabs();

  if (variant === 'title') {
    if (!IS_BENEFITS_TAB_ENABLED) {
      return <SizableText size="$heading2xl">{tabs[0].label}</SizableText>;
    }
    return (
      <XStack ai="center" gap="$4" flexShrink={1}>
        {tabs.map((tab) => {
          const isActive = tab.value === value;
          return (
            <SizableText
              key={tab.value}
              testID={tab.testID}
              role="tab"
              aria-selected={isActive}
              size="$heading2xl"
              color={isActive ? '$text' : '$textDisabled'}
              numberOfLines={1}
              cursor="default"
              onPress={() => {
                onChange(tab.value);
              }}
            >
              {tab.label}
            </SizableText>
          );
        })}
      </XStack>
    );
  }

  return <SimpleTabs value={value} onChange={onChange} tabs={tabs} />;
}
