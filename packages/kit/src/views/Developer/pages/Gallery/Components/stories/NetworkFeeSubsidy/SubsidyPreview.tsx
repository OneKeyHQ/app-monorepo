import { useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  Icon,
  Input,
  SizableText,
  runAfterActionListClose,
} from '@onekeyhq/components';
import type { ITronRewardCardState } from '@onekeyhq/kit/src/views/RewardCenter/pages/RewardCenter';
import { getTronClaimLabel } from '@onekeyhq/kit/src/views/RewardCenter/tronClaimLabel';
import { tronRewardActionSize } from '@onekeyhq/kit/src/views/RewardCenter/tronRewardActionSize';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const previewOptions = [
  { value: 'live', label: '跟随真实状态' },
  { value: 'guest', label: '未登录' },
  { value: 'available', label: '可领取' },
  { value: 'claimed', label: '今日已领取' },
  { value: 'exhausted', label: '今日已领完' },
  { value: 'monthlyLimit', label: '本月已达上限' },
  { value: 'inactive', label: '账户待激活' },
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
        onPress: (close) =>
          runAfterActionListClose(close, () => onSelect(value)),
      }))}
    />
  );
}

export function TronRewardPreview({
  mode,
  validUntil,
  onModeChange,
  renderInline,
}: {
  mode: Exclude<ISubsidyPreviewMode, 'live' | 'guest'>;
  validUntil?: number;
  onModeChange: (value: 'claimed' | 'available') => void;
  renderInline: (state: ITronRewardCardState) => ReactNode;
}) {
  const intl = useIntl();
  const [code, setCode] = useState('');
  const [redeemed, setRedeemed] = useState(false);
  const claimed = mode === 'claimed';
  const exhausted = mode === 'exhausted';
  const monthlyLimitReached = mode === 'monthlyLimit';
  const accountName = '预览账户';
  const claimLabel = monthlyLimitReached
    ? ETranslations.tron_energy_claim_limit_reached_notice
    : getTronClaimLabel(claimed, exhausted);
  const accountButton =
    mode === 'inactive' ? (
      <Button
        testID="subsidy-preview-account"
        {...tronRewardActionSize}
        variant="primary"
        onPress={() => onModeChange('available')}
      >
        {intl.formatMessage({ id: ETranslations.global_top_up })} ≥ 0.1 TRX
      </Button>
    ) : null;

  let remaining = 128;
  if (claimed) remaining -= 1;
  if (exhausted) remaining = 0;
  let monthlyRemaining = claimed ? 9 : 10;
  if (monthlyLimitReached) monthlyRemaining = 0;
  return renderInline({
    accountName,
    claimed,
    exhausted,
    validUntil,
    claimDetails: {
      remaining,
      total: 500,
      monthlyRemaining,
      monthlyLimit: 10,
      inventoryFallback: null,
      accountSelector: (
        <SizableText size="$bodyMdMedium">{accountName}</SizableText>
      ),
      claimButton: accountButton ?? (
        <Button
          testID="subsidy-preview-claim"
          variant="primary"
          {...tronRewardActionSize}
          disabled={claimed || exhausted || monthlyLimitReached}
          onPress={() => onModeChange('claimed')}
        >
          {intl.formatMessage({ id: claimLabel })}
        </Button>
      ),
      redeemField: (
        <Input
          accessibilityLabel="兑换码"
          placeholder="输入兑换码"
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setRedeemed(false);
          }}
          size="large"
          containerProps={{
            borderWidth: 0,
            borderBottomWidth: 1,
            borderRadius: 0,
          }}
          InputComponentStyle={{ pl: '$0' }}
        />
      ),
      redeemButton: accountButton ?? (
        <Button
          testID="subsidy-preview-redeem"
          variant="primary"
          {...tronRewardActionSize}
          disabled={!code.trim()}
          onPress={() => {
            setCode('');
            setRedeemed(true);
          }}
        >
          {intl.formatMessage({
            id: redeemed
              ? ETranslations.redemption_success_title
              : ETranslations.global_redeem,
          })}
        </Button>
      ),
    },
  });
}
