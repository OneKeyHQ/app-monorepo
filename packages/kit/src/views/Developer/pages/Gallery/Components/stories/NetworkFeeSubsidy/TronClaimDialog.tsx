import type { ReactNode } from 'react';
import { useState } from 'react';

import { useOverlayPageScope } from '@onekeyfe/react-native-native-overlay';
import { useIntl } from 'react-intl';

import {
  Dialog,
  DialogContainer,
  Progress,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITronRewardCardState } from '@onekeyhq/kit/src/views/RewardCenter/pages/RewardCenter';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const subsidyDialogProps = {
  boundedSheetLayout: true,
  useInitialSafeAreaBottomInsetFallback: Boolean(platformEnv.isNative),
  showCancelButton: false,
  footerProps: { pb: '$6', $md: { pb: '$10' } },
} as const;

const energyTabs = [
  { label: '每日领取', value: 'claim', testID: 'subsidy-tron-tab-claim' },
  { label: '兑换码', value: 'redeem', testID: 'subsidy-tron-tab-redeem' },
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

export function TronClaimDialog({
  open,
  onClose,
  details,
  claimed,
  validUntil,
}: {
  open: boolean;
  onClose: () => void;
  details: ITronRewardCardState['claimDetails'];
  claimed: boolean;
  validUntil?: number;
}) {
  const intl = useIntl();
  const { hostKey, ownerKey } = useOverlayPageScope();
  const [tab, setTab] = useState<'claim' | 'redeem'>('claim');
  const isClaimTab = tab === 'claim';
  const action = isClaimTab ? details.claimButton : details.redeemButton;
  const { remaining, total, monthlyRemaining, monthlyLimit } = details;
  const hasInventory = remaining !== undefined && total !== undefined;
  const content = (
    <YStack gap="$4">
      <SegmentControl
        fullWidth
        value={tab}
        options={energyTabs}
        onChange={(value) => setTab(value === 'redeem' ? 'redeem' : 'claim')}
      />
      {isClaimTab ? (
        <YStack
          bg="$bgSubdued"
          borderRadius="$6"
          borderCurve="continuous"
          p="$4"
          gap="$3"
        >
          <YStack gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
              今日剩余
            </SizableText>
            {hasInventory ? (
              <XStack alignItems="baseline" flexWrap="wrap" gap="$1.5">
                <SizableText size="$heading3xl">{remaining}</SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  / {total}
                </SizableText>
              </XStack>
            ) : (
              details.inventoryFallback
            )}
          </YStack>
          {hasInventory && total > 0 ? (
            <Progress
              value={(remaining / total) * 100}
              size="medium"
              progressColor="$bgStrong"
              indicatorColor="$bgAccent"
            />
          ) : null}
          <SizableText size="$bodySm" color="$textSubdued">
            每个地址每日可领取 1 次，领取资格每日 00:00（GMT+8）重置。
          </SizableText>
        </YStack>
      ) : null}
      {isClaimTab ? (
        <>
          <YStack>
            <ClaimDetailRow label="领取账户">
              {details.accountSelector}
            </ClaimDetailRow>
            {monthlyRemaining !== undefined && monthlyLimit !== undefined ? (
              <ClaimDetailRow label="本地址本月剩余">
                <SizableText
                  size="$bodyMdMedium"
                  textAlign="right"
                  fontVariant={['tabular-nums']}
                >
                  {monthlyRemaining} / {monthlyLimit} 次
                </SizableText>
              </ClaimDetailRow>
            ) : null}
          </YStack>
          {details.alert}
          {claimed ? (
            <SizableText size="$bodySmMedium" color="$textSuccess">
              {validUntil
                ? `今日已领取，请在 ${intl.formatTime(validUntil, { hour: '2-digit', minute: '2-digit' })} 前使用。`
                : '当前地址今日已领取。'}
            </SizableText>
          ) : null}
        </>
      ) : (
        <>
          <YStack gap="$1">
            <ClaimDetailRow label="领取账户">
              {details.accountSelector}
            </ClaimDetailRow>
            {details.redeemField}
          </YStack>
          {details.redeemAlert}
          <YStack gap="$2">
            <SizableText size="$headingSm">使用说明</SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              兑换的能量将发放至所选 TRON 账户。
            </SizableText>
          </YStack>
        </>
      )}
    </YStack>
  );

  return (
    <DialogContainer
      open={open}
      onClose={async () => {
        setTab('claim');
        onClose();
      }}
      overlayPage={hostKey && ownerKey ? { hostKey, ownerKey } : undefined}
      title="免费能量"
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
