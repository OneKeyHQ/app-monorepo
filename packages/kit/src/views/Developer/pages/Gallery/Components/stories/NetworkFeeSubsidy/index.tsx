import { useHeaderHeight } from '@react-navigation/elements';

import {
  Button,
  Page,
  ScrollView,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ETestModalPages } from '@onekeyhq/shared/src/routes';
import type {
  ITestModalPagesParam,
  ITronClaimDemoScenario,
} from '@onekeyhq/shared/src/routes/testModal';

const energyPackageScenarios: {
  value: NonNullable<
    ITestModalPagesParam[ETestModalPages.NetworkFeeSubsidy]['energyPackageScenario']
  >;
  label: string;
}[] = [
  { value: 'available', label: 'Prime · 能量包有余额' },
  { value: 'exhausted', label: 'Prime · 本月能量包已用完' },
  { value: 'notPrime', label: '普通用户 · 购买能量包' },
  { value: 'purchased', label: '普通用户 · 已购 20 份' },
  { value: 'mixed', label: 'Prime · 赠送与已购额度' },
];

const claimScenarios: { value: ITronClaimDemoScenario; label: string }[] = [
  { value: 'available', label: '可以领取' },
  { value: 'claimed', label: '今日已领取' },
  { value: 'exhausted', label: '资源已领完' },
  { value: 'monthlyLimit', label: '地址月度限额' },
  { value: 'ipLimit', label: 'IP 月度限额' },
  { value: 'inactive', label: '地址未激活' },
  { value: 'watching', label: '观察账户' },
  { value: 'missingAccount', label: '暂无 TRON 账户' },
  { value: 'failed', label: '领取失败后重试' },
];

export default function NetworkFeeSubsidyGallery() {
  const navigation = useAppNavigation();
  const headerHeight = useHeaderHeight();

  return (
    <Page>
      <Page.Header title="网络费补贴" />
      <Page.Body pt={platformEnv.isNativeIOS26Plus ? headerHeight : 0}>
        <ScrollView>
          <YStack p="$5" gap="$3">
            {[true, false].map((initialSignedIn) => (
              <Button
                key={String(initialSignedIn)}
                onPress={() => {
                  navigation.pushModal(EModalRoutes.TestModal, {
                    screen: ETestModalPages.NetworkFeeSubsidy,
                    params: { initialSignedIn },
                  });
                }}
              >
                {initialSignedIn ? '查看补贴（已登录）' : '查看补贴（未登录）'}
              </Button>
            ))}
            <SizableText size="$headingMd">TRON 能量包</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              以下为设计演示：每月 30 份、剩余 24
              份、价格及有效期均为示例，非正式权益。购买仅更新本地演示余额，不会扣款。
            </SizableText>
            {energyPackageScenarios.map(({ value, label }) => (
              <Button
                key={value}
                onPress={() => {
                  navigation.pushModal(EModalRoutes.TestModal, {
                    screen: ETestModalPages.NetworkFeeSubsidy,
                    params: {
                      initialSignedIn: true,
                      energyPackageScenario: value,
                    },
                  });
                }}
              >
                {label}
              </Button>
            ))}
            <SizableText size="$headingMd">TRON 领取状态</SizableText>
            {claimScenarios.map(({ value, label }) => (
              <Button
                key={value}
                onPress={() => {
                  navigation.pushModal(EModalRoutes.TestModal, {
                    screen: ETestModalPages.NetworkFeeSubsidy,
                    params: { initialSignedIn: true, tronClaimScenario: value },
                  });
                }}
              >
                {label}
              </Button>
            ))}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
