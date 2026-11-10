import type { ReactNode } from 'react';
import { useState } from 'react';

import { useOverlayPageScope } from '@onekeyfe/react-native-native-overlay';

import {
  Dialog,
  DialogContainer,
  ScrollView,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITronRewardCardState } from '@onekeyhq/kit/src/views/RewardCenter/pages/RewardCenter';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { InventoryProgress } from './InventoryProgress';

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

export function TronClaimView({
  dialog,
  details,
}: {
  dialog?: { open: boolean; onClose: () => void };
  details: ITronRewardCardState['claimDetails'];
}) {
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
          bg={dialog ? '$bgSubdued' : '$bg'}
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
            <InventoryProgress value={(remaining / total) * 100} />
          ) : null}
          <SizableText size="$bodySm" color="$textSubdued">
            每个地址每日可领取 1 次，领取资格每日 00:00（GMT+8）重置。
          </SizableText>
        </YStack>
      ) : null}
      <YStack gap={isClaimTab ? '$0' : '$1'}>
        <ClaimDetailRow label="领取账户">
          {details.accountSelector}
        </ClaimDetailRow>
        {isClaimTab &&
        monthlyRemaining !== undefined &&
        monthlyLimit !== undefined ? (
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
        {isClaimTab ? null : details.redeemField}
      </YStack>
      {!isClaimTab ? (
        <YStack gap="$2">
          <SizableText size="$headingSm">使用说明</SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            兑换的能量将发放至所选 TRON 账户。
          </SizableText>
        </YStack>
      ) : null}
    </YStack>
  );

  if (!dialog) {
    return (
      <YStack flex={1} minHeight={0} gap="$5">
        <ScrollView flex={1}>{content}</ScrollView>
        {action ? (
          <YStack
            alignSelf="flex-end"
            flexShrink={0}
            minWidth={160}
            maxWidth="100%"
          >
            {action}
          </YStack>
        ) : null}
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
