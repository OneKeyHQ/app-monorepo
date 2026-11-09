import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import { useRoute } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';

import {
  Badge,
  Button,
  Dialog,
  Icon,
  IconButton,
  Page,
  Progress,
  ScrollView,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useInModalDialog,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import type {
  ETestModalPages,
  ITestModalPagesParam,
} from '@onekeyhq/shared/src/routes';

import { DemoOneKeyIdLoginContent } from './DemoOneKeyIdLoginContent';
import { EnergyArtwork } from './EnergyArtwork';
import {
  createEnergyPackageDemo,
  getPurchasedUnits,
  purchaseLifetime,
} from './energyPackageDemo';
import { EnergyPackageRow } from './EnergyPackageRow';
import { LoginRequiredBadge } from './LoginRequiredBadge';
import { TronClaimContent } from './TronClaimContent';
import {
  createTronClaimDemo,
  formatResourceTime,
  getTronClaimStatus,
  useTronClaimClock,
} from './tronClaimDemo';

import type { RouteProp } from '@react-navigation/native';

type IBenefit = {
  id: 'tron' | 'multichain';
  title: string;
  icon: IKeyOfIcons;
  remaining: string;
  total: string;
  unit: string;
  allowance: string;
  amountLabel: string;
  reset: string;
  progress: number;
  networks: string;
  scope: string;
  rules: string[];
};

// This gallery intentionally keeps copy and fixtures local; it never reads real
// identity, balances, sponsorship eligibility, or transaction services.
const benefitTemplates: IBenefit[] = [
  {
    id: 'tron',
    title: 'TRON 能量补贴',
    icon: 'FlashSolid',
    remaining: '128',
    total: '500',
    unit: '/ 500',
    allowance: '每地址每日 1 次，每月最多 10 次',
    amountLabel: '资源剩余',
    reset: 'GMT+8 每日重置领取资格',
    progress: 25.6,
    networks: 'TRON',
    scope: 'OneKey 内的 USDT 转账',
    rules: [
      '选择已激活的 TRON 地址领取资源，领取后 10 分钟内有效。',
      '同一地址每日可领一次（GMT+8 重置），每月最多 10 次，并受 IP 月度限制。',
      '补贴仅覆盖符合条件的能量费用，带宽等其他费用以交易确认页为准。',
    ],
  },
  {
    id: 'multichain',
    title: '多链网络费补贴',
    icon: 'GasOutline',
    remaining: '1.80',
    total: '2.00',
    unit: 'USD',
    allowance: '每日 $2.00',
    amountLabel: '今日剩余',
    reset: '明日 00:00 重置 · UTC+8',
    progress: 90,
    networks: 'Ethereum、Base、Arbitrum',
    scope: '指定网络上的部分转账与兑换',
    rules: [
      '登录 OneKey ID 后，在交易确认页检查本次补贴资格。',
      '同一 OneKey ID 下的地址与网络共享每日额度。',
      '支持范围与补贴金额以交易确认页为准，超出补贴部分需自行支付。',
    ],
  },
];

type ISubsidyRecord = {
  title: string;
  subtitle: string;
  saved: string;
  icon: IKeyOfIcons;
};

const records: ISubsidyRecord[] = [
  {
    title: 'USDT 转账',
    subtitle: 'TRON · 今天 10:24',
    saved: '$1.24',
    icon: 'FlashSolid',
  },
  {
    title: 'USDC 转账',
    subtitle: 'Base · 昨天 18:06',
    saved: '$0.08',
    icon: 'GasOutline',
  },
  {
    title: 'USDT 转账',
    subtitle: 'TRON · 昨天 09:41',
    saved: '$1.18',
    icon: 'FlashSolid',
  },
  ...[
    0.12, 1.2, 0.18, 1.18, 0.22, 1.24, 0.09, 1.22, 0.14, 1.26, 0.16, 1.19, 0.25,
    1.21, 0.7,
  ].map((saved, index): ISubsidyRecord => {
    const isTron = index % 2 === 1;
    const day = String(12 - Math.floor(index / 2)).padStart(2, '0');
    return {
      title: isTron ? 'USDT 转账' : 'USDC 转账',
      subtitle: `${isTron ? 'TRON' : 'Base'} · 10-${day} ${isTron ? '09:41' : '18:06'}`,
      saved: `$${saved.toFixed(2)}`,
      icon: isTron ? 'FlashSolid' : 'GasOutline',
    };
  }),
];

const usageSteps = [
  {
    title: '登录 OneKey ID',
    description: '登录后查看可领取的资源和可用补贴。',
  },
  {
    title: '领取或查看补贴',
    description:
      'TRON 免费资源需选择账户领取，有效期为 10 分钟；Prime 能量包每月自动到账，多链网络费补贴无需领取。',
  },
  {
    title: '发起交易并使用补贴',
    description:
      '发起支持的转账或兑换，在交易确认页查看补贴和自付金额。已领取的 TRON 免费资源需在有效期内使用。',
  },
];

function SubsidyRecordList({ items }: { items: ISubsidyRecord[] }) {
  return (
    <YStack
      bg="$bgSubdued"
      borderRadius="$6"
      borderCurve="continuous"
      overflow="hidden"
      p="$4"
      gap="$6"
    >
      {items.map((record) => (
        <XStack key={record.subtitle} alignItems="center" gap="$3">
          <Stack
            width="$8"
            height="$8"
            flexShrink={0}
            alignItems="center"
            justifyContent="center"
          >
            <Icon name={record.icon} size="$6" color="$iconSubdued" />
          </Stack>
          <YStack flex={1} minWidth={0} gap="$1">
            <XStack alignItems="baseline" gap="$3">
              <SizableText size="$bodyMdMedium" flex={1}>
                {record.title}
              </SizableText>
              <SizableText
                size="$bodyMdMedium"
                color="$textSuccess"
                flexShrink={0}
              >
                {record.saved}
              </SizableText>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {record.subtitle}
            </SizableText>
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

function SubsidySummaryStats({ availableCount }: { availableCount: number }) {
  const { width, fontScale } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(width);
  const stacked = containerWidth < 320 || fontScale > 1.3;

  return (
    <Stack
      flexDirection={stacked ? 'column' : 'row'}
      mt="$2"
      bg="$bgSubdued"
      borderRadius="$6"
      borderCurve="continuous"
      overflow="hidden"
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      {[
        { label: '已补贴交易', value: '18 笔' },
        { label: '可用补贴', value: `${availableCount} 项` },
      ].map(({ label, value }, index) => (
        <Stack
          key={label}
          flex={stacked ? undefined : 1}
          minWidth={0}
          flexDirection={stacked ? 'row' : 'column'}
          alignItems={stacked ? 'center' : 'stretch'}
          gap={stacked ? '$4' : '$1'}
          p="$4"
          borderLeftWidth={!stacked && index === 1 ? 1 : 0}
          borderLeftColor="$bgApp"
          borderTopWidth={stacked && index === 1 ? 1 : 0}
          borderTopColor="$bgApp"
        >
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            textAlign={stacked ? 'left' : 'center'}
            flex={1}
            minWidth={0}
          >
            {label}
          </SizableText>
          <SizableText
            size="$headingMd"
            textAlign={stacked ? 'right' : 'center'}
            flexShrink={0}
          >
            {value}
          </SizableText>
        </Stack>
      ))}
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack
      gap="$4"
      justifyContent="space-between"
      alignItems="flex-start"
      py="$3"
    >
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium" flex={1} textAlign="right">
        {value}
      </SizableText>
    </XStack>
  );
}

function BenefitAmount({
  benefit,
  signedIn,
  showLabel = true,
}: {
  benefit: IBenefit;
  signedIn: boolean;
  showLabel?: boolean;
}) {
  return (
    <YStack gap="$1">
      {showLabel ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {benefit.id === 'tron' || signedIn ? benefit.amountLabel : '每日额度'}
        </SizableText>
      ) : null}
      <XStack alignItems="baseline" gap="$1.5">
        <SizableText size="$heading3xl">
          {benefit.id === 'tron' || signedIn
            ? benefit.remaining
            : benefit.total}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {benefit.unit}
        </SizableText>
      </XStack>
    </YStack>
  );
}

function BenefitCard({
  benefit,
  signedIn,
  onPress,
  action,
  claimNotice,
}: {
  benefit: IBenefit;
  signedIn: boolean;
  onPress: () => void;
  action?: ReactNode;
  claimNotice?: string;
}) {
  return (
    <YStack
      flex={1}
      minWidth={0}
      bg="$bgSubdued"
      borderRadius="$6"
      borderCurve="continuous"
      overflow="hidden"
      p="$4"
      gap="$4"
    >
      <XStack alignItems="center" gap="$3">
        <SizableText
          size="$bodyXs"
          color="$textDisabled"
          textTransform="uppercase"
          letterSpacing={1.2}
          flex={1}
        >
          {benefit.title}
        </SizableText>
        <Button
          testID={`subsidy-detail-${benefit.id}`}
          variant="tertiary"
          hoverStyle={{ bg: '$transparent', opacity: 0.8 }}
          pressStyle={{ bg: '$transparent', opacity: 0.6 }}
          size="small"
          mx="$0"
          my="$0"
          px="$0"
          py="$0"
          borderWidth={0}
          hitSlop={16}
          flexShrink={0}
          childrenAsText={false}
          onPress={onPress}
        >
          <XStack alignItems="center" gap="$1">
            <SizableText
              size="$bodyXs"
              color="$textDisabled"
              letterSpacing={1.2}
            >
              详情
            </SizableText>
            <Icon
              name="ChevronRightSmallOutline"
              size="$3"
              color="$iconDisabled"
            />
          </XStack>
        </Button>
      </XStack>
      <YStack gap="$2">
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <BenefitAmount
            benefit={benefit}
            signedIn={signedIn}
            showLabel={false}
          />
          {action ?? (
            <Badge
              bg={signedIn ? '$bgSuccess' : '$bgStrong'}
              borderRadius={signedIn ? '$full' : '$1'}
              borderWidth={signedIn ? 1 : 0}
              borderColor="$transparent"
              px={signedIn ? '$2.5' : '$2'}
              py={signedIn ? '$1' : '$0.5'}
              flexShrink={0}
            >
              <SizableText
                size={signedIn ? '$bodyMdMedium' : '$bodySmMedium'}
                color={signedIn ? '$textSuccess' : '$textSubdued'}
              >
                {signedIn ? '已激活' : '需登录'}
              </SizableText>
            </Badge>
          )}
        </XStack>
        <YStack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            {benefit.id === 'tron' || signedIn
              ? benefit.amountLabel
              : '每日额度'}
          </SizableText>
          {signedIn ? (
            <Progress
              value={benefit.progress}
              size="medium"
              progressColor="$bgStrong"
              indicatorColor={benefit.id === 'tron' ? '#EF0027' : '$bgAccent'}
            />
          ) : null}
        </YStack>
        {claimNotice ? (
          <SizableText size="$bodySm" color="$textSuccess">
            {claimNotice}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}

function NetworkFeeSubsidy() {
  const { params } =
    useRoute<
      RouteProp<ITestModalPagesParam, ETestModalPages.NetworkFeeSubsidy>
    >();
  const [signedIn, setSignedIn] = useState(params?.initialSignedIn ?? true);
  const [energyPackage, setEnergyPackage] = useState(() =>
    createEnergyPackageDemo(params?.energyPackageScenario),
  );
  const [tronClaim, setTronClaim] = useState(() =>
    createTronClaimDemo(params?.tronClaimScenario),
  );
  const now = useTronClaimClock(tronClaim);
  const tronStatus = getTronClaimStatus(tronClaim, now);
  let freeEnergyNotice = '登录后查看领取资格';
  let freeEnergyAction = '登录领取';
  if (signedIn) {
    freeEnergyAction = tronStatus.canClaim ? '领取' : '查看';
    if (tronStatus.secondsLeft > 0) {
      freeEnergyNotice = `有效期剩余 ${formatResourceTime(tronStatus.secondsLeft)}`;
    } else if (tronStatus.claimedToday) {
      freeEnergyNotice = '今日已领取 · 明日重置';
    } else if (tronStatus.canClaim) {
      freeEnergyNotice = '领取后 10 分钟内有效';
    } else {
      freeEnergyNotice = tronStatus.reason ?? '请查看领取资格';
    }
  }
  const benefits = benefitTemplates.map((benefit) =>
    benefit.id === 'tron'
      ? {
          ...benefit,
          remaining: String(tronClaim.remaining),
          total: String(tronClaim.total),
          unit: `/ ${tronClaim.total}`,
          progress:
            tronClaim.total > 0
              ? (tronClaim.remaining / tronClaim.total) * 100
              : 0,
        }
      : benefit,
  );
  const dialog = useInModalDialog();
  const insets = useSafeAreaInsets();

  const showRules = useCallback(() => {
    dialog.show({
      title: '补贴规则',
      boundedSheetLayout: true,
      showCancelButton: false,
      onConfirmText: '知道了',
      renderContent: (
        <YStack gap="$5">
          {[
            [
              '使用条件',
              '使用补贴需要登录 OneKey ID。是否可用还取决于网络、交易类型和剩余额度。',
            ],
            [
              '领取与使用',
              'TRON 免费资源按所选地址领取，受资源余额、地址和 IP 月度限额约束；领取后 10 分钟内有效。多链补贴在符合条件的交易中使用。',
            ],
            [
              '能量包',
              '能量包绑定 OneKey ID。Prime 赠送额度按月重置，购买额度按各自有效期使用。仅支持 TRON USDT 转账，每次消耗 1–2 份，与免费资源独立计算。',
            ],
            [
              '费用确认',
              '实际减免及自付金额以交易确认页为准。个人额度用完或当日活动额度耗尽时，补贴可能暂不可用。',
            ],
          ].map(([title, description]) => (
            <YStack key={title} gap="$2">
              <SizableText size="$headingSm">{title}</SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {description}
              </SizableText>
            </YStack>
          ))}
        </YStack>
      ),
    });
  }, [dialog]);

  const renderHeaderRight = useCallback(
    () => (
      <IconButton
        icon="QuestionmarkOutline"
        variant="tertiary"
        accessibilityLabel="补贴规则"
        onPress={showRules}
      />
    ),
    [showRules],
  );

  const showLogin = (onSuccess?: () => void) => {
    const loginDialog = dialog.show({
      boundedSheetLayout: true,
      showFooter: false,
      renderContent: (
        <DemoOneKeyIdLoginContent
          onComplete={async () => {
            await loginDialog.close();
            setSignedIn(true);
            onSuccess?.();
            Toast.success({ title: '登录成功' });
          }}
        />
      ),
    });
  };

  const openTronClaim = () => {
    const claimDialog = dialog.show({
      title: '领取 TRON 免费资源',
      boundedSheetLayout: true,
      showFooter: false,
      renderContent: (
        <TronClaimContent
          initialState={tronClaim}
          onChange={setTronClaim}
          onSuccess={async () => {
            await claimDialog.close();
            Toast.success({
              title: '领取成功',
              message: '请在 10 分钟内使用资源。',
            });
          }}
        />
      ),
    });
  };

  const showTronClaim = () => {
    if (!signedIn) {
      showLogin(openTronClaim);
      return;
    }
    openTronClaim();
  };

  const showDetails = (benefit: IBenefit) => {
    if (benefit.id === 'tron') {
      showTronClaim();
      return;
    }
    const detailsDialog = dialog.show({
      title: benefit.title,
      boundedSheetLayout: true,
      showCancelButton: false,
      onConfirmText: signedIn ? '知道了' : '登录 OneKey ID',
      onConfirm: async ({ preventClose }) => {
        if (!signedIn) {
          preventClose();
          await detailsDialog.close();
          showLogin();
        }
      },
      renderContent: (
        <YStack gap="$5" testID={`subsidy-drawer-${benefit.id}`}>
          <YStack
            bg="$bgSubdued"
            borderRadius="$6"
            borderCurve="continuous"
            overflow="hidden"
            p="$4"
            gap="$3"
          >
            <BenefitAmount benefit={benefit} signedIn={signedIn} />
            <SizableText size="$bodySm" color="$textSubdued">
              {benefit.reset}
            </SizableText>
          </YStack>
          <YStack>
            <DetailRow label="支持网络" value={benefit.networks} />
            <DetailRow label="适用操作" value={benefit.scope} />
            <DetailRow label="补贴上限" value={benefit.allowance} />
          </YStack>
          <YStack gap="$3">
            <SizableText size="$headingSm">使用说明</SizableText>
            {benefit.rules.map((rule) => (
              <SizableText key={rule} size="$bodyMd" color="$textSubdued">
                {rule}
              </SizableText>
            ))}
          </YStack>
        </YStack>
      ),
    });
  };

  return (
    <Page>
      <Page.Header title="补贴中心" headerRight={renderHeaderRight} />
      <Page.Body>
        <ScrollView
          flex={1}
          contentContainerStyle={{
            paddingBottom: insets.bottom,
          }}
        >
          <YStack
            width="100%"
            maxWidth={960}
            alignSelf="center"
            px="$5"
            pb="$5"
            gap="$6"
          >
            <YStack pt={signedIn ? '$2' : 0}>
              {signedIn ? null : (
                <Stack
                  alignSelf="center"
                  width={240}
                  height={240}
                  mt={-24}
                  mb={-116}
                  zIndex={1}
                  pointerEvents="none"
                  $gtMd={{ width: 280, height: 280, mt: -28, mb: -136 }}
                >
                  <EnergyArtwork />
                </Stack>
              )}
              <YStack
                bg={signedIn ? '$transparent' : '$bgSubdued'}
                borderRadius="$6"
                borderCurve="continuous"
                p={signedIn ? 0 : '$4'}
                pt={signedIn ? 0 : 96}
                gap={signedIn ? '$2' : '$5'}
                $gtMd={{ pt: signedIn ? 0 : 112 }}
              >
                <YStack alignItems="center" gap="$2" pt={signedIn ? '$2' : 0}>
                  {signedIn ? (
                    <>
                      <SizableText
                        size="$heading4xl"
                        fontSize={40}
                        lineHeight={48}
                        textAlign="center"
                      >
                        $12.86
                      </SizableText>
                      <SizableText
                        size="$bodyXs"
                        color="$textDisabled"
                        textTransform="uppercase"
                        letterSpacing={1.2}
                        textAlign="center"
                      >
                        累计获得补贴
                      </SizableText>
                    </>
                  ) : (
                    <SizableText
                      size="$bodyLgMedium"
                      textAlign="center"
                      py="$2"
                    >
                      登录后即可享受网络费补贴
                    </SizableText>
                  )}
                </YStack>
                {signedIn ? (
                  <SubsidySummaryStats
                    availableCount={
                      energyPackage.giftUnits +
                        getPurchasedUnits(energyPackage) >
                      0
                        ? 3
                        : 2
                    }
                  />
                ) : (
                  <Button
                    testID="subsidy-mock-login"
                    variant="accent"
                    size="large"
                    onPress={() => showLogin()}
                  >
                    登录 OneKey ID
                  </Button>
                )}
              </YStack>
            </YStack>

            <YStack gap="$3">
              <SizableText size="$headingMd">
                {signedIn ? '我的补贴' : '可享补贴'}
              </SizableText>
              <YStack
                bg="$bgSubdued"
                borderRadius="$6"
                borderCurve="continuous"
                overflow="hidden"
                testID="subsidy-tron-energy"
              >
                <YStack p="$4" gap="$4">
                  <XStack alignItems="center" gap="$3">
                    <SizableText size="$bodyXs" color="$textDisabled" flex={1}>
                      TRON 能量
                    </SizableText>
                    <Button
                      size="small"
                      variant="tertiary"
                      mx="$0"
                      my="$0"
                      px="$0"
                      py="$0"
                      borderWidth={0}
                      hitSlop={12}
                      childrenAsText={false}
                      onPress={showRules}
                    >
                      <XStack alignItems="center" gap="$1">
                        <SizableText size="$bodyXs" color="$textDisabled">
                          规则
                        </SizableText>
                        <Icon
                          name="ChevronRightSmallOutline"
                          size="$3"
                          color="$iconDisabled"
                        />
                      </XStack>
                    </Button>
                  </XStack>
                  <XStack alignItems="center" gap="$3" flexWrap="wrap">
                    <YStack flex={1} minWidth={160} gap="$2">
                      <SizableText size="$bodyMdMedium">
                        {signedIn && tronStatus.secondsLeft > 0
                          ? '免费能量已到账'
                          : '每日免费能量'}
                      </SizableText>
                      <SizableText
                        size="$bodySm"
                        color={
                          signedIn && tronStatus.secondsLeft > 0
                            ? '$textSuccess'
                            : '$textSubdued'
                        }
                      >
                        {freeEnergyNotice}
                      </SizableText>
                    </YStack>
                    {signedIn ? (
                      <Button
                        testID="subsidy-tron-claim"
                        size="small"
                        variant="primary"
                        flexShrink={0}
                        onPress={showTronClaim}
                      >
                        {freeEnergyAction}
                      </Button>
                    ) : (
                      <LoginRequiredBadge />
                    )}
                  </XStack>
                </YStack>
                <Stack height={1} bg="$bgApp" />
                <EnergyPackageRow
                  signedIn={signedIn}
                  state={energyPackage}
                  onLogin={showLogin}
                  onPurchase={(units) =>
                    setEnergyPackage((current) => ({
                      ...current,
                      purchases: [
                        ...current.purchases,
                        { units, expiresAt: Date.now() + purchaseLifetime },
                      ],
                    }))
                  }
                />
              </YStack>
              {benefits
                .filter((benefit) => benefit.id !== 'tron')
                .map((benefit) => (
                  <BenefitCard
                    key={benefit.id}
                    benefit={benefit}
                    signedIn={signedIn}
                    onPress={() => showDetails(benefit)}
                  />
                ))}
            </YStack>

            {signedIn ? (
              <YStack gap="$3">
                <XStack
                  alignItems="center"
                  justifyContent="space-between"
                  gap="$3"
                >
                  <SizableText size="$headingMd">补贴记录</SizableText>
                  <Button
                    testID="subsidy-view-all-records"
                    childrenAsText={false}
                    variant="tertiary"
                    size="small"
                    mx="$0"
                    my="$0"
                    px="$0"
                    py="$0"
                    borderWidth={0}
                    hitSlop={12}
                    hoverStyle={{ bg: '$transparent', opacity: 0.8 }}
                    pressStyle={{ bg: '$transparent', opacity: 0.6 }}
                    onPress={() => {
                      dialog.show({
                        title: '全部补贴记录',
                        boundedSheetLayout: true,
                        showFooter: false,
                        renderContent: (
                          <Dialog.ScrollView maxHeight={440}>
                            <SubsidyRecordList items={records} />
                          </Dialog.ScrollView>
                        ),
                      });
                    }}
                  >
                    <XStack alignItems="center" gap="$1">
                      <SizableText size="$bodySm" color="$textDisabled">
                        查看更多
                      </SizableText>
                      <Icon
                        name="ChevronRightSmallOutline"
                        size="$4"
                        color="$iconDisabled"
                      />
                    </XStack>
                  </Button>
                </XStack>
                <SubsidyRecordList items={records.slice(0, 6)} />
              </YStack>
            ) : (
              <YStack gap="$4">
                <SizableText size="$headingMd">操作说明</SizableText>
                <YStack>
                  {usageSteps.map((step, index) => (
                    <YStack key={step.title}>
                      <XStack gap="$3" alignItems="center">
                        <Stack width="$6" alignItems="center" flexShrink={0}>
                          <Stack
                            width={18}
                            height={18}
                            borderRadius="$full"
                            bg="$bgAccent"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <SizableText
                              size="$bodyXsMedium"
                              color="$textInverse"
                            >
                              {index + 1}
                            </SizableText>
                          </Stack>
                        </Stack>
                        <SizableText
                          size="$bodyMdMedium"
                          color="$text"
                          flex={1}
                        >
                          {step.title}
                        </SizableText>
                      </XStack>
                      <XStack gap="$3" alignItems="stretch">
                        <YStack width="$6" alignItems="center" flexShrink={0}>
                          {index < usageSteps.length - 1 ? (
                            <Stack
                              width={1}
                              flex={1}
                              bg="$borderSubdued"
                              my="$1"
                            />
                          ) : null}
                        </YStack>
                        <YStack
                          flex={1}
                          minWidth={0}
                          pt="$1"
                          pb={index < usageSteps.length - 1 ? '$5' : '$0'}
                        >
                          <SizableText
                            size="$bodySm"
                            lineHeight={20}
                            color="$textSubdued"
                          >
                            {step.description}
                          </SizableText>
                        </YStack>
                      </XStack>
                    </YStack>
                  ))}
                </YStack>
              </YStack>
            )}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default NetworkFeeSubsidy;
