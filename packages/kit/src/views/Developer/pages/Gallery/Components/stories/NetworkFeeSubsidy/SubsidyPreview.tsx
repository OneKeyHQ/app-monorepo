import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  ActionList,
  Button,
  Icon,
  Input,
  SizableText,
  Toast,
} from '@onekeyhq/components';
import type { ITronRewardCardState } from '@onekeyhq/kit/src/views/RewardCenter/pages/RewardCenter';

const previewOptions = [
  { value: 'live', label: '跟随真实状态' },
  { value: 'guest', label: '未登录' },
  { value: 'available', label: '已登录 · 未领取' },
  { value: 'claimed', label: '已登录 · 今日已领取' },
  { value: 'exhausted', label: '已登录 · 今日已领完' },
] as const;

export type ISubsidyPreviewMode = (typeof previewOptions)[number]['value'];

export function SubsidyPreviewMenu({
  mode,
  onSelect,
}: {
  mode: ISubsidyPreviewMode;
  onSelect: (value: ISubsidyPreviewMode) => void;
}) {
  return (
    <ActionList
      title="状态预览"
      renderTrigger={
        <Button testID="subsidy-preview-menu" size="small" variant="tertiary">
          {mode === 'live' ? '预览' : '预览中'}
        </Button>
      }
      items={previewOptions.map(({ value, label }) => ({
        label,
        testID: `subsidy-preview-${value}`,
        extra:
          mode === value ? (
            <Icon name="CheckRadioSolid" size="$5" />
          ) : undefined,
        onPress: () => onSelect(value),
      }))}
    />
  );
}

export function TronRewardPreview({
  mode,
  validUntil,
  onClaim,
  renderInline,
}: {
  mode: Exclude<ISubsidyPreviewMode, 'live' | 'guest'>;
  validUntil?: number;
  onClaim: () => void;
  renderInline: (state: ITronRewardCardState) => ReactNode;
}) {
  const [code, setCode] = useState('');
  const claimed = mode === 'claimed';
  const exhausted = mode === 'exhausted';
  const accountName = '预览账户';
  let remaining = 128;
  let buttonLabel = '领取';
  if (claimed) {
    remaining -= 1;
    buttonLabel = '已领取';
  } else if (exhausted) {
    remaining = 0;
    buttonLabel = '已领完';
  }
  return renderInline({
    accountName,
    claimed,
    exhausted,
    validUntil,
    claimDetails: {
      remaining,
      total: 500,
      monthlyRemaining: claimed ? 9 : 10,
      monthlyLimit: 10,
      inventoryFallback: null,
      accountSelector: (
        <SizableText size="$bodyMdMedium">{accountName}</SizableText>
      ),
      alert: null,
      redeemAlert: null,
      claimButton: (
        <Button
          testID="subsidy-preview-claim"
          variant="primary"
          size="large"
          disabled={claimed || exhausted}
          onPress={onClaim}
        >
          {buttonLabel}
        </Button>
      ),
      redeemField: (
        <Input
          accessibilityLabel="兑换码"
          placeholder="输入兑换码"
          value={code}
          onChangeText={setCode}
          size="large"
          containerProps={{
            borderWidth: 0,
            borderBottomWidth: 1,
            borderRadius: 0,
          }}
          InputComponentStyle={{ pl: '$0' }}
        />
      ),
      redeemButton: (
        <Button
          testID="subsidy-preview-redeem"
          variant="primary"
          size="large"
          disabled={!code.trim()}
          onPress={() => {
            setCode('');
            Toast.message({ title: '兑换预览完成' });
          }}
        >
          兑换
        </Button>
      ),
    },
  });
}
