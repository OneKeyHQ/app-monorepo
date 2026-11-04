import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferFriendsTestIDs } from '../../../testIDs';

import {
  COMPACT_ENTRY_TITLE_PROPS,
  INVITE_POPOVER_PANEL_PROPS,
} from './useInviteCardStyle';

import type {
  IInviteRewardScopeItem,
  IInviteRewardSubject,
} from './getInviteRewardRows';

function stopPropagation(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

// Product names match the level targets and rates ("Perps volume", "Swap
// fees"), so each product reads the same everywhere on the referral pages.
export const INVITE_REWARD_SUBJECT_TITLE: Record<
  IInviteRewardSubject,
  ETranslations
> = {
  hardware: ETranslations.referral_referred_type_3,
  perps: ETranslations.perps_perps,
  swap: ETranslations.global_swap,
  defi: ETranslations.referral_referred_type_2,
};

function RewardScopeList({
  items,
  showHeadings,
}: {
  items: readonly IInviteRewardScopeItem[];
  showHeadings: boolean;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$3">
      {items.map((item) => (
        <YStack key={item.subject} gap="$0.5">
          {showHeadings ? (
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: INVITE_REWARD_SUBJECT_TITLE[item.subject],
              })}
            </SizableText>
          ) : null}
          <SizableText size="$bodyMd" color="$textSubdued">
            {item.description}
          </SizableText>
        </YStack>
      ))}
    </YStack>
  );
}

// The same panel as the page's other info popovers (rates, payout): hover on
// pointer layouts, a sheet on compact layouts and native. A sheet names the
// popover in its header, so a single product does not repeat its name below.
function RewardScopePopover({
  title,
  items,
  placement,
  trigger,
}: {
  title: string;
  items: readonly IInviteRewardScopeItem[];
  placement: 'top' | 'bottom-start';
  trigger: ReactElement;
}) {
  const { md } = useMedia();
  const isSheet = platformEnv.isNative || md;
  return (
    <Popover
      title={title}
      hoverable
      placement={placement}
      floatingPanelProps={INVITE_POPOVER_PANEL_PROPS}
      renderTrigger={trigger}
      renderContent={
        <YStack px="$5" py="$4">
          <RewardScopeList
            items={items}
            showHeadings={!isSheet || items.length > 1}
          />
        </YStack>
      }
    />
  );
}

// Sits on the product name. Its press must not open the detail page.
export function RewardScopeInfo({
  title,
  subject,
  description,
}: {
  title: string;
  subject: IInviteRewardSubject;
  description: string;
}) {
  const items = useMemo(
    () => [{ subject, description }],
    [subject, description],
  );
  return (
    <Stack
      onPress={stopPropagation}
      flexShrink={0}
      m={platformEnv.isNative ? '$-3' : undefined}
    >
      <RewardScopePopover
        title={title}
        items={items}
        placement="bottom-start"
        trigger={
          <Stack
            testID={ReferFriendsTestIDs.inviteRewardScopeInfo}
            p={platformEnv.isNative ? '$3' : undefined}
          >
            <Icon name="InfoCircleOutline" size="$4" color="$iconSubdued" />
          </Stack>
        }
      />
    </Stack>
  );
}

// One entry for every visible product that has scope copy, because the empty
// card has no product rows to hang an icon on.
export function RewardScopesHint({
  items,
}: {
  items: readonly IInviteRewardScopeItem[];
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const isTouchLayout = platformEnv.isNative || md;
  return (
    <RewardScopePopover
      title={intl.formatMessage({
        id: ETranslations.referral_earnings_by_product__title,
      })}
      items={items}
      placement="top"
      trigger={
        // Reads as part of the copy above: same size and color, with dashes
        // marking it as explained on hover or tap. On touch layouts the
        // padding grows the tap area to 44px and the margin keeps the layout
        // where it was.
        <Stack
          testID={ReferFriendsTestIDs.inviteRewardScopeLearnMore}
          cursor="default"
          {...(isTouchLayout ? { py: '$3', my: '$-3' } : null)}
        >
          <DashText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </DashText>
        </Stack>
      }
    />
  );
}

// A compact list row's title with the scope icon right after the name, for
// `ListItem.renderItemText`.
export function RewardScopeCompactTitle({
  title,
  subject,
  description,
}: {
  title: string;
  subject: IInviteRewardSubject;
  description: string;
}) {
  return (
    <XStack
      flex={1}
      ai="center"
      gap="$1"
      minWidth={0}
      // Keep the full native trigger inside its parent's touch bounds.
      minHeight={platformEnv.isNative ? '$10' : undefined}
      my={platformEnv.isNative ? '$-2' : undefined}
    >
      <SizableText
        {...COMPACT_ENTRY_TITLE_PROPS}
        flexShrink={1}
        minWidth={0}
        numberOfLines={1}
        userSelect="none"
      >
        {title}
      </SizableText>
      <RewardScopeInfo
        title={title}
        subject={subject}
        description={description}
      />
    </XStack>
  );
}
