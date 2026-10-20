import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { SimpleTabs } from '@onekeyhq/kit/src/views/ReferFriends/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { EReferralPageTab, type IReferralPageTab } from '../referralPageTab';

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
        label: intl.formatMessage({ id: ETranslations.referral_perks__title }),
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
  // `header`: compact layouts put the tab names in the navigation bar's
  // title slot at title size; the active one reads in full color.
  variant?: 'tabs' | 'header';
}) {
  const tabs = useReferralTabs();

  if (variant === 'header') {
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
              size="$headingLg"
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
