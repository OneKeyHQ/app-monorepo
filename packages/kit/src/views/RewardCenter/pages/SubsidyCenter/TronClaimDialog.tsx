import type { ReactNode } from 'react';
import { useState } from 'react';

import { useOverlayPageScope } from '@onekeyfe/react-native-native-overlay';
import { useIntl } from 'react-intl';

import {
  Alert,
  Dialog,
  DialogContainer,
  Icon,
  ScrollView,
  SegmentControl,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITronRewardCardState } from '@onekeyhq/kit/src/views/RewardCenter/pages/RewardCenter';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { InventoryProgress } from './InventoryProgress';

export const subsidyDialogProps = {
  boundedSheetLayout: true,
  useInitialSafeAreaBottomInsetFallback: Boolean(platformEnv.isNative),
  showCancelButton: false,
  footerProps: { pb: '$6', $md: { pb: '$10' } },
} as const;

const accountNoticeTestID = 'subsidy-tron-account-notice';

const energyTabs = [
  {
    label: ETranslations.subsidy_daily_claim__title,
    value: 'claim',
    testID: 'subsidy-tron-tab-claim',
  },
  {
    label: ETranslations.redemption_btc_label_code,
    value: 'redeem',
    testID: 'subsidy-tron-tab-redeem',
  },
];

function ClaimDetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <XStack alignItems="center" minHeight="$11" gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <XStack
        flex={1}
        minWidth={0}
        alignSelf="stretch"
        alignItems="center"
        justifyContent="flex-end"
      >
        {children}
      </XStack>
    </XStack>
  );
}

export function TronClaimView({
  dialog,
  details,
}: {
  dialog?: { open: boolean; onClose: () => void };
  details: ITronRewardCardState['claimDetails'];
}) {
  const intl = useIntl();
  const { hostKey, ownerKey } = useOverlayPageScope();
  const [tab, setTab] = useState<'claim' | 'redeem'>('claim');
  const isClaimTab = tab === 'claim';
  const action = isClaimTab ? details.claimButton : details.redeemButton;
  const {
    remaining,
    total,
    monthlyRemaining,
    monthlyLimit,
    inventoryLoading,
    accountNotice,
  } = details;
  const hasInventory = remaining !== undefined && total !== undefined;
  const hasMonthly =
    monthlyRemaining !== undefined && monthlyLimit !== undefined;
  // The view is laid out the same while the inventory loads as after it
  // arrives: the number row, the progress track and the monthly row keep
  // their space, so nothing below them moves when the data lands.
  const content = (
    <YStack gap="$4">
      <SegmentControl
        fullWidth
        value={tab}
        options={energyTabs.map((option) => ({
          ...option,
          label: intl.formatMessage({ id: option.label }),
        }))}
        onChange={(value) => setTab(value === 'redeem' ? 'redeem' : 'claim')}
      />
      {isClaimTab ? (
        <YStack
          bg={dialog ? '$bgSubdued' : '$bg'}
          borderRadius="$6"
          borderCurve="continuous"
          p="$4"
          gap="$3"
        >
          <YStack gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.subsidy_remaining_today__title,
              })}
            </SizableText>
            {hasInventory ? (
              <XStack alignItems="baseline" flexWrap="wrap" gap="$1.5">
                <SizableText size="$heading3xl">{remaining}</SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  / {total}
                </SizableText>
              </XStack>
            ) : (
              <XStack alignItems="center">
                {/* Invisible, zero-width copy of the number: holds its row height. */}
                <SizableText
                  size="$heading3xl"
                  width={0}
                  opacity={0}
                  aria-hidden
                >
                  0
                </SizableText>
                {details.inventoryFallback}
              </XStack>
            )}
          </YStack>
          <InventoryProgress
            value={hasInventory && total > 0 ? (remaining / total) * 100 : 0}
          />
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.subsidy_daily_reset__desc,
            })}
          </SizableText>
        </YStack>
      ) : null}
      <YStack gap={isClaimTab ? '$0' : '$1'}>
        <ClaimDetailRow
          label={intl.formatMessage({
            id: ETranslations.subsidy_claim_account__title,
          })}
        >
          {details.accountSelector}
        </ClaimDetailRow>
        {isClaimTab && (hasMonthly || inventoryLoading) ? (
          <ClaimDetailRow
            label={intl.formatMessage({
              id: ETranslations.subsidy_monthly_remaining__title,
            })}
          >
            {hasMonthly ? (
              <SizableText
                size="$bodyMdMedium"
                textAlign="right"
                fontVariant={['tabular-nums']}
              >
                {intl.formatMessage(
                  { id: ETranslations.subsidy_monthly_count__desc },
                  { remaining: monthlyRemaining, limit: monthlyLimit },
                )}
              </SizableText>
            ) : (
              <Skeleton.BodyMd />
            )}
          </ClaimDetailRow>
        ) : null}
        {isClaimTab ? null : details.redeemField}
      </YStack>
      {!isClaimTab ? (
        <YStack gap="$2">
          <SizableText size="$headingSm">
            {intl.formatMessage({
              id: ETranslations.subsidy_instructions__title,
            })}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.subsidy_redeem_account__desc,
            })}
          </SizableText>
        </YStack>
      ) : null}
      {/* Last, next to the action it explains, so nothing above moves when
          it appears once the account's activation is known. */}
      {dialog && accountNotice ? (
        <Alert
          testID={accountNoticeTestID}
          type="warning"
          icon="InfoCircleOutline"
          title={accountNotice}
          closable={false}
        />
      ) : null}
    </YStack>
  );

  if (!dialog) {
    // The panel has a fixed height that the claim details already fill, so
    // the notice shares the action's row instead of joining the scrolling
    // content, where it would end up half clipped.
    return (
      <YStack flex={1} minHeight={0} gap="$5">
        <ScrollView flex={1}>{content}</ScrollView>
        <XStack
          flexShrink={0}
          alignItems="center"
          justifyContent="flex-end"
          gap="$4"
        >
          {accountNotice ? (
            <XStack
              flex={1}
              minWidth={0}
              alignItems="center"
              gap="$2"
              testID={accountNoticeTestID}
            >
              <Icon
                name="InfoCircleOutline"
                size="$5"
                color="$iconCaution"
                flexShrink={0}
              />
              <SizableText
                size="$bodyMd"
                color="$textCaution"
                flex={1}
                minWidth={0}
              >
                {accountNotice}
              </SizableText>
            </XStack>
          ) : null}
          {action ? (
            <YStack flexShrink={0} minWidth={104} maxWidth="100%">
              {action}
            </YStack>
          ) : null}
        </XStack>
      </YStack>
    );
  }

  return (
    <DialogContainer
      open={dialog.open}
      onClose={async () => {
        setTab('claim');
        dialog.onClose();
      }}
      overlayPage={hostKey && ownerKey ? { hostKey, ownerKey } : undefined}
      title={intl.formatMessage({
        id: ETranslations.wallet_subsidy_redeem_title,
      })}
      testID="subsidy-tron-claim-dialog"
      {...subsidyDialogProps}
      sheetDragArea="header"
      showFooter={Boolean(action)}
      showConfirmButton={false}
      leadingContent={<YStack flex={1}>{action}</YStack>}
      renderContent={
        platformEnv.isNative ? (
          content
        ) : (
          <Dialog.ScrollView>{content}</Dialog.ScrollView>
        )
      }
    />
  );
}
