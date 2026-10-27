import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Icon,
  NATIVE_HIT_SLOP,
  SegmentControl,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { EReferralPageTab, type IReferralPageTab } from '../referralPageTab';
import { useReferralTabCopy } from '../referralTabCopy';

// Same floating thumb as the DeFi earn/borrow switch. The item itself stays
// flat so it does not stack a second shadow on the thumb.
const REFERRAL_TAB_SEGMENT_ITEM_PROPS = {
  elevation: 0,
  flexGrow: 1,
  cursor: 'default',
  '$platform-native': {
    elevation: 0,
  },
  '$platform-web': {
    boxShadow: 'none',
  },
} as const;

function useReferralTabs() {
  const intl = useIntl();
  const tabCopy = useReferralTabCopy();
  return useMemo(
    () => [
      {
        value: EReferralPageTab.invite,
        label: intl.formatMessage({ id: ETranslations.sidebar_refer_a_friend }),
        description: tabCopy.inviteRole,
        testID: ReferFriendsTestIDs.inviteTab,
      },
      {
        value: EReferralPageTab.benefits,
        label: intl.formatMessage({ id: ETranslations.referral_perks__title }),
        description: tabCopy.perksIntro,
        testID: ReferFriendsTestIDs.benefitsTab,
      },
    ],
    [intl, tabCopy],
  );
}

// Compact switch: the current tab's name as a title with a chevron. A tap
// opens both tabs with who each one is for, the current one checked.
function ReferralTabSwitcher({
  tabs,
  value,
  onChange,
}: {
  tabs: ReturnType<typeof useReferralTabs>;
  value: IReferralPageTab;
  onChange: (value: IReferralPageTab) => void;
}) {
  const intl = useIntl();
  const activeTab = tabs.find((tab) => tab.value === value) ?? tabs[0];
  const openSwitch = useCallback(() => {
    ActionList.show({
      title: intl.formatMessage({ id: ETranslations.sidebar_refer_a_friend }),
      sheetProps: { snapPointsMode: 'fit' },
      items: tabs.map((tab) => ({
        testID: tab.testID,
        label: tab.label,
        description: tab.description,
        extra:
          tab.value === value ? (
            <Icon name="CheckRadioSolid" size="$5" color="$icon" />
          ) : undefined,
        onPress: () => {
          onChange(tab.value);
        },
      })),
    });
  }, [intl, onChange, tabs, value]);

  return (
    <XStack
      testID="refer-friends-tab-switcher"
      role="button"
      ai="center"
      gap="$1"
      cursor="default"
      // Title-size text alone is under 44px; the slop makes the title a
      // full touch target in the navigation bar.
      hitSlop={NATIVE_HIT_SLOP}
      onPress={openSwitch}
    >
      <SizableText size="$headingLg" numberOfLines={1}>
        {activeTab.label}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

export function ReferralJobTabs({
  value,
  onChange,
  variant = 'tabs',
}: {
  value: IReferralPageTab;
  onChange: (value: IReferralPageTab) => void;
  // `compact`: compact layouts show only the current tab, as a title with a
  // chevron that opens the switch; Perks is the minor side of referrals.
  variant?: 'tabs' | 'compact';
}) {
  const tabs = useReferralTabs();

  if (variant === 'compact') {
    return (
      <ReferralTabSwitcher tabs={tabs} value={value} onChange={onChange} />
    );
  }

  return (
    <SegmentControl
      value={value}
      options={tabs}
      minWidth={264}
      onChange={(next) => {
        onChange(next as IReferralPageTab);
      }}
      segmentControlItemStyleProps={REFERRAL_TAB_SEGMENT_ITEM_PROPS}
    />
  );
}
