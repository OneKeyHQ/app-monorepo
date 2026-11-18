import { useCallback, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Accordion,
  Button,
  Icon,
  NumberSizeableText,
  Page,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useInModalDialog,
  useMedia,
} from '@onekeyhq/components';
import type {
  IPageNavigationProp,
  ISizableTextProps,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorProvider';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { showOneKeyIdLoginFailedToast } from '@onekeyhq/kit/src/views/Prime/components/oneKeyIdLoginToastUtils';
import type { ITronRewardCardState } from '@onekeyhq/kit/src/views/RewardCenter/pages/RewardCenter';
import { TronRewardCenterContent } from '@onekeyhq/kit/src/views/RewardCenter/pages/RewardCenter';
import { getTronClaimLabel } from '@onekeyhq/kit/src/views/RewardCenter/tronClaimLabel';
import { tronRewardActionSize } from '@onekeyhq/kit/src/views/RewardCenter/tronRewardActionSize';
import { useSettingsPageStyle } from '@onekeyhq/kit/src/views/Setting/pages/Tab/useSettingsPageStyle';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalRewardCenterParamList } from '@onekeyhq/shared/src/routes';
import { EModalRewardCenterRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  DesktopSubsidyLayout,
  desktopSubsidySidebarWidth,
} from './DesktopSubsidyLayout';
import { EnergyArtwork } from './EnergyArtwork';
import {
  SubsidyRecentRecords,
  SubsidyRecordsPanel,
  SubsidySummaryLoadFailed,
  subsidyRecordsCopy,
} from './SubsidyRecords';
import {
  SUBSIDY_RECENT_RECORD_LIMIT,
  formatSubsidyCount,
  subsidyRecordCopy,
} from './subsidyRecordUtils';
import { TronClaimView, subsidyDialogProps } from './TronClaimDialog';
import {
  useSubsidyHistory,
  useSubsidyIdentity,
  useSubsidySummary,
} from './useSubsidyRecords';

import type { ISubsidyPanel } from './DesktopSubsidyLayout';
import type { ISubsidySummaryView } from './subsidyRecordUtils';
import type { ISubsidyQuery } from './useSubsidyRecords';
import type { RouteProp } from '@react-navigation/core';

const loginRequiredLabel = '需登录';

const multichainBenefit = {
  title: '多链网络费补贴',
  networks: 'Ethereum、Base、Arbitrum',
  scope: '指定网络上的部分转账与兑换',
  rules: [
    '登录 OneKey ID 即可享受补贴，无需单独领取。',
    '支持范围与补贴金额以交易确认页为准，超出补贴部分需自行支付。',
  ],
};

const subsidyFAQs = [
  {
    question: '如何领取 TRON 免费能量？',
    answer:
      '登录 OneKey ID 后，点「TRON 免费能量」，选择要使用的 TRON 账户并领取。能量到账后有效期为 10 分钟，请在有效期内完成转账。',
  },
  {
    question: '为什么今天领不了免费能量？',
    answer:
      '每个地址每天可领一次，领取资格在 GMT+8 零点重置。如果当天的免费能量已领完，或地址、IP 已达到月度上限，也会暂时无法领取。',
  },
  {
    question: '多链网络费补贴也需要领取吗？',
    answer:
      '登录 OneKey ID 即可享受补贴，无需单独领取。在支持的网络发起转账或兑换时，可以在交易确认页查看本次补贴金额。',
  },
  {
    question: '如何知道这笔交易还要支付多少网络费？',
    answer:
      '在交易确认页查看实际补贴金额和自付金额。网络费高于本次补贴时，超出的部分需要自行支付。',
  },
];

// TODO(OK-67058): move to i18n keys once the copy is final.
const summaryCopy = {
  totalLabel: 'GA 累计赞助金额',
  gaSettledLabel: 'GA 已结算',
  gaSettledUnit: '笔',
  tronAcceptedLabel: 'Tron 能量申请已受理',
  tronAcceptedUnit: '次',
};

const usageSteps = [
  {
    title: '登录 OneKey ID',
    shortDescription: '查看当前可用的补贴。',
    description: '登录后可查看 TRON 能量领取资格和多链网络费补贴。',
  },
  {
    title: '领取或查看补贴',
    shortDescription: '按地址领取 TRON 能量，多链补贴登录后即可使用。',
    description:
      '选择 TRON 账户领取免费能量，领取后 10 分钟内有效。多链网络费补贴在登录后即可使用。',
  },
  {
    title: '发起交易并使用补贴',
    shortDescription: '在交易确认页查看补贴金额和自付网络费。',
    description:
      '发起支持的转账或兑换，在交易确认页查看本次补贴和需自行支付的网络费。',
  },
];

function GuestUsageGuide({ compact = false }: { compact?: boolean }) {
  const stepSpacing = compact ? '$3' : '$5';
  return (
    <YStack gap={compact ? '$5' : '$4'}>
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
                  bg={compact ? '$bgStrong' : '$bgAccent'}
                  alignItems="center"
                  justifyContent="center"
                >
                  <SizableText
                    size="$bodyXsMedium"
                    color={compact ? '$text' : '$textInverse'}
                  >
                    {index + 1}
                  </SizableText>
                </Stack>
              </Stack>
              <SizableText size="$bodyMdMedium" color="$text" flex={1}>
                {step.title}
              </SizableText>
            </XStack>
            <XStack gap="$3" alignItems="stretch">
              <YStack width="$6" alignItems="center" flexShrink={0}>
                {index < usageSteps.length - 1 ? (
                  <Stack width={1} flex={1} bg="$borderSubdued" my="$1" />
                ) : null}
              </YStack>
              <YStack
                flex={1}
                minWidth={0}
                pt="$1"
                pb={index < usageSteps.length - 1 ? stepSpacing : '$0'}
              >
                <SizableText
                  size="$bodySm"
                  lineHeight={20}
                  color="$textSubdued"
                >
                  {compact ? step.shortDescription : step.description}
                </SizableText>
              </YStack>
            </XStack>
          </YStack>
        ))}
      </YStack>
    </YStack>
  );
}

// The headline amount is the Gas Account sponsor cost. It has no value until
// a settled record carries an evidenced amount, and that must read as blank
// rather than as $0.
function SubsidyTotalAmount({
  query,
  ...textProps
}: {
  query: ISubsidyQuery<ISubsidySummaryView>;
} & Omit<ISizableTextProps, 'children'>) {
  if (query.isLoading) {
    // An invisible copy of the amount holds the exact line box of the final
    // text, so the placeholder and the value occupy the same height.
    return (
      <Stack>
        <SizableText {...textProps} opacity={0} aria-hidden>
          {subsidyRecordCopy.noValue}
        </SizableText>
        <Stack
          position="absolute"
          top={0}
          bottom={0}
          left={0}
          right={0}
          justifyContent="center"
          alignItems={
            textProps.textAlign === 'center' ? 'center' : 'flex-start'
          }
        >
          <Skeleton width={96} height="$6" />
        </Stack>
      </Stack>
    );
  }
  const amount = query.data?.sponsorCostUsd;
  if (!amount) {
    return (
      <SizableText {...textProps}>{subsidyRecordCopy.noValue}</SizableText>
    );
  }
  return (
    <NumberSizeableText
      {...textProps}
      formatter="value"
      formatterOptions={{ currency: '$' }}
    >
      {amount}
    </NumberSizeableText>
  );
}

// Settled Gas Account sponsorships and accepted TRON energy requests are
// counted separately: the server does not merge them into one number.
function SubsidySummaryStats({
  query,
  compact = false,
}: {
  query: ISubsidyQuery<ISubsidySummaryView>;
  // Plain rows for the desktop sidebar, where the two-cell card would push
  // the panel links below the fold of the fixed-height modal.
  compact?: boolean;
}) {
  const summaryStats = [
    {
      label: summaryCopy.gaSettledLabel,
      value: formatSubsidyCount(
        query.data?.gaSettledCount,
        summaryCopy.gaSettledUnit,
      ),
    },
    {
      label: summaryCopy.tronAcceptedLabel,
      value: formatSubsidyCount(
        query.data?.tronAcceptedCount,
        summaryCopy.tronAcceptedUnit,
      ),
    },
  ];
  const { width, fontScale } = useWindowDimensions();
  // Start from the width the card will be laid out at (the page's 20px
  // gutters) so the first frame already picks the right arrangement.
  const [containerWidth, setContainerWidth] = useState(width - 40);
  const stacked = containerWidth < 320 || fontScale > 1.3;

  if (query.isError) {
    return (
      <SubsidySummaryLoadFailed compact={compact} onRetry={query.reload} />
    );
  }

  if (compact) {
    return (
      <YStack mt="$2" gap="$1" testID="subsidy-summary-stats">
        {summaryStats.map(({ label, value }) => (
          <XStack key={label} alignItems="center" gap="$3">
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              flex={1}
              minWidth={0}
              numberOfLines={1}
            >
              {label}
            </SizableText>
            <SizableText size="$bodySmMedium" flexShrink={0}>
              {value}
            </SizableText>
          </XStack>
        ))}
      </YStack>
    );
  }

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
      {summaryStats.map(({ label, value }, index) => (
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

function MultichainDetails() {
  return (
    <YStack gap="$5" testID="subsidy-drawer-multichain">
      <YStack>
        <DetailRow label="支持网络" value={multichainBenefit.networks} />
        <DetailRow label="适用操作" value={multichainBenefit.scope} />
      </YStack>
      <YStack gap="$3">
        <SizableText size="$headingSm">使用说明</SizableText>
        {multichainBenefit.rules.map((rule) => (
          <SizableText key={rule} size="$bodyMd" color="$textSubdued">
            {rule}
          </SizableText>
        ))}
      </YStack>
    </YStack>
  );
}

function SubsidyFAQ() {
  return (
    <Accordion type="single" collapsible>
      {subsidyFAQs.map(({ question, answer }) => (
        <Accordion.Item key={question} value={question}>
          <Accordion.Trigger
            unstyled
            group
            cursor="pointer"
            flexDirection="row"
            alignItems="center"
            gap="$3"
            minHeight="$11"
            borderWidth={0}
            borderRadius="$3"
            mx="$-2"
            px="$2"
            py="$2"
            bg="$transparent"
            hoverStyle={{ bg: '$bgSubdued' }}
            pressStyle={{ bg: '$bgActive' }}
            focusVisibleStyle={{
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineColor: '$focusRing',
            }}
          >
            {({ open }: { open: boolean }) => (
              <>
                <SizableText
                  flex={1}
                  minWidth={0}
                  textAlign="left"
                  size={open ? '$bodyMdMedium' : '$bodyMd'}
                  color="$text"
                >
                  {question}
                </SizableText>
                <Stack
                  flexShrink={0}
                  transition="quick"
                  rotate={open ? '-180deg' : '0deg'}
                >
                  <Icon
                    name="ChevronDownSmallOutline"
                    size="$4"
                    color={open ? '$iconActive' : '$iconSubdued'}
                    $group-hover={{ color: '$iconHover' }}
                  />
                </Stack>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.HeightAnimator transition="quick" overflow="hidden">
            <Accordion.Content unstyled pt="$1" pb="$3" pr="$6">
              <SizableText size="$bodyMd" color="$textSubdued">
                {answer}
              </SizableText>
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

function BenefitCard({
  title,
  description,
  descriptionMaxWidth,
  actionLabel,
  onPress,
  testID,
  cardTestID,
  selected,
  listRow,
}: {
  title: string;
  description: string;
  descriptionMaxWidth?: number;
  actionLabel?: string;
  onPress: () => void | Promise<void>;
  testID: string;
  cardTestID?: string;
  selected?: boolean;
  listRow: boolean;
}) {
  return (
    <Button
      testID={testID}
      childrenAsText={false}
      onPress={onPress}
      alignSelf="stretch"
      height="auto"
      px={listRow ? '$3' : '$4'}
      py="$4"
      bg="$bgSubdued"
      borderRadius="$6"
      borderWidth={0}
      {...(listRow && {
        bg: '$transparent',
        mx: '$-3',
        pr: '$2.5',
        py: '$2',
        borderRadius: '$3',
        hoverStyle: { bg: '$bgHover' },
        pressStyle: { bg: '$bgHover' },
      })}
      aria-pressed={selected}
    >
      <XStack
        testID={cardTestID}
        flex={1}
        alignItems="center"
        gap="$3"
        pointerEvents="none"
      >
        <ListItem.Text
          flex={1}
          minWidth={0}
          gap="$1"
          primary={title}
          secondary={description}
          primaryTextProps={{ size: '$headingSm' }}
          secondaryTextProps={{
            size: '$bodySm',
            maxWidth: descriptionMaxWidth,
          }}
        />
        <XStack alignItems="center" flexShrink={0} gap="$1.5">
          {actionLabel ? (
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {actionLabel}
            </SizableText>
          ) : null}
          <ListItem.DrillIn color={selected ? '$iconActive' : '$iconSubdued'} />
        </XStack>
      </XStack>
    </Button>
  );
}

function SubsidyCenter() {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalRewardCenterParamList>>();
  const { params: routeParams } =
    useRoute<
      RouteProp<
        IModalRewardCenterParamList,
        EModalRewardCenterRoutes.RewardCenter
      >
    >();
  const { isLoggedIn, loginOneKeyId } = useOneKeyAuth();
  const signedIn = Boolean(isLoggedIn);
  const identity = useSubsidyIdentity();
  const summaryQuery = useSubsidySummary(identity);
  const historyQuery = useSubsidyHistory(identity);
  // A claim or redemption adds a record and can change the totals.
  const { reload: reloadSummary } = summaryQuery;
  const { reload: reloadHistory } = historyQuery;
  const refreshRecords = useCallback(() => {
    reloadSummary();
    reloadHistory();
  }, [reloadSummary, reloadHistory]);
  const { gtMd } = useMedia();
  const wide = Boolean(
    gtMd &&
    (platformEnv.isDesktop || platformEnv.isWeb || platformEnv.isExtension),
  );
  const desktopGuest = wide && !signedIn;
  const { pageBackgroundColor, headerStyle, headerBackgroundColor } =
    useSettingsPageStyle(wide && signedIn);
  const [activePanel, setPanel] = useState<ISubsidyPanel>('tron');
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const openTron = useCallback(() => {
    setPanel('tron');
    setClaimDialogOpen(!wide);
  }, [wide]);
  const loginPending = useRef(false);
  const isMounted = useIsMounted();
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const dialog = useInModalDialog();
  // The TRON energy entries that predate the subsidy center (wallet "More",
  // transaction confirmation) open this page for one account. They expect the
  // claim itself, so the claim sheet opens once the page has settled; opening
  // it during the push transition would race the modal animation.
  const opensTronClaim = Boolean(
    routeParams?.accountId && routeParams?.networkId,
  );
  const handlePageMounted = useCallback(() => {
    if (opensTronClaim && !wide) {
      setClaimDialogOpen(true);
    }
  }, [opensTronClaim, wide]);
  // What the claim panel shows until the account is resolved: the same
  // structure as the loaded panel, so it settles in place instead of
  // replacing a single placeholder line.
  const loadingClaimDetails = useMemo<ITronRewardCardState['claimDetails']>(
    () => ({
      inventoryLoading: true,
      inventoryFallback: <Skeleton.BodyLg />,
      accountSelector: <Skeleton width={96} height="$6" />,
      claimButton: (
        <Button
          testID="subsidy-tron-claim-loading"
          variant="primary"
          {...tronRewardActionSize}
          disabled
        >
          {intl.formatMessage({ id: getTronClaimLabel(false, false) })}
        </Button>
      ),
      redeemField: null,
      redeemButton: null,
    }),
    [intl],
  );
  const showLogin = async (onSuccess?: () => void) => {
    if (loginPending.current) return;
    loginPending.current = true;
    try {
      await loginOneKeyId();
    } catch (error) {
      showOneKeyIdLoginFailedToast({ error, intl });
      return;
    } finally {
      loginPending.current = false;
    }
    if (isMounted.current) onSuccess?.();
  };

  const showMultichainDetails = () => {
    if (wide) {
      setPanel('multichain');
      return;
    }
    const detailsDialog = dialog.show({
      title: multichainBenefit.title,
      ...subsidyDialogProps,
      onConfirmText: signedIn ? '知道了' : '登录 OneKey ID',
      onConfirm: async ({ preventClose }) => {
        if (!signedIn) {
          preventClose();
          await detailsDialog.close();
          await showLogin();
        }
      },
      renderContent: <MultichainDetails />,
    });
  };

  const overview = signedIn ? (
    <YStack gap="$2">
      <YStack alignItems="center" gap="$2" pt="$2">
        <SubsidyTotalAmount
          query={summaryQuery}
          size="$heading4xl"
          fontSize={40}
          lineHeight={48}
          textAlign="center"
        />
        <SizableText
          size="$bodyXs"
          color="$textDisabled"
          letterSpacing={1.2}
          textAlign="center"
        >
          {summaryCopy.totalLabel}
        </SizableText>
      </YStack>
      <SubsidySummaryStats query={summaryQuery} />
    </YStack>
  ) : (
    <YStack>
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
      <YStack
        bg="$bgSubdued"
        borderRadius="$6"
        borderCurve="continuous"
        p="$4"
        pt={96}
        gap="$5"
        $gtMd={{ pt: 112 }}
      >
        <SizableText size="$bodyLgMedium" textAlign="center" py="$2">
          登录后即可享受网络费补贴
        </SizableText>
        <Button
          testID="subsidy-login"
          variant="accent"
          size="large"
          onPress={() => showLogin()}
        >
          登录 OneKey ID
        </Button>
      </YStack>
    </YStack>
  );
  const multichainActionLabel = signedIn ? '查看详情' : loginRequiredLabel;
  const multichainCard = (
    <BenefitCard
      testID="subsidy-detail-multichain"
      listRow={wide}
      selected={wide && signedIn ? activePanel === 'multichain' : undefined}
      title={multichainBenefit.title}
      description={
        signedIn ? '支持的转账与兑换可享补贴' : '部分转账与兑换可享网络费补贴'
      }
      actionLabel={signedIn && wide ? undefined : multichainActionLabel}
      onPress={desktopGuest ? () => showLogin() : showMultichainDetails}
    />
  );

  const renderSubsidyBenefits = ({
    accountName,
    claimed = false,
    validUntil,
    exhausted = false,
    claimDetails: rewardClaimDetails,
  }: Partial<ITronRewardCardState> = {}) => {
    // An entry that fixes the account (transaction confirmation) hides the
    // selector, so the claim view names the account in plain text instead.
    const claimDetails = rewardClaimDetails && {
      ...rewardClaimDetails,
      accountSelector: rewardClaimDetails.accountSelector ?? (
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {accountName}
        </SizableText>
      ),
    };
    let description = signedIn ? '每日按地址领取' : '每个地址每日最多领取一次';
    let actionLabel = signedIn ? '去领取' : loginRequiredLabel;
    if (claimed) {
      const notice = validUntil
        ? `今日已领取，请在 ${intl.formatTime(validUntil, { hour: '2-digit', minute: '2-digit' })} 前使用资源`
        : '今日已领取';
      description = [accountName, notice].filter(Boolean).join(' · ');
      actionLabel = '已领取';
    } else if (exhausted) {
      description = '仍可使用兑换码';
      actionLabel = '已领完';
    }
    const tronCard = (
      <BenefitCard
        cardTestID="subsidy-tron-energy"
        testID="subsidy-tron-claim"
        listRow={wide}
        selected={wide && signedIn ? activePanel === 'tron' : undefined}
        title="TRON 免费能量"
        description={description}
        descriptionMaxWidth={wide && claimed ? 168 : undefined}
        actionLabel={
          wide && signedIn && !claimed && !exhausted ? undefined : actionLabel
        }
        onPress={async () => {
          if (!signedIn) {
            await showLogin(openTron);
            return;
          }
          openTron();
        }}
      />
    );
    if (desktopGuest) {
      return (
        <ScrollView
          flex={1}
          contentContainerStyle={{ flexGrow: 1 }}
          testID="subsidy-desktop-guest"
        >
          <XStack
            flexGrow={1}
            px="$6"
            pt="$2"
            pb="$6"
            gap="$6"
            alignItems="stretch"
          >
            <YStack
              width={desktopSubsidySidebarWidth}
              borderRadius="$5"
              bg="$bgSubdued"
              p="$5"
              gap="$4"
              alignItems="center"
              justifyContent="center"
            >
              {/* Discount the PNG's transparent padding when centering the login content. */}
              <Stack
                width="100%"
                maxWidth={248}
                aspectRatio={1}
                y={-20}
                mt="$-11"
                mb="$-8"
                pointerEvents="none"
              >
                <EnergyArtwork />
              </Stack>
              <SizableText size="$headingMd" textAlign="center">
                登录后即可享受网络费补贴
              </SizableText>
              <Button
                testID="subsidy-login"
                variant="accent"
                size="large"
                width="100%"
                maxWidth={216}
                onPress={() => showLogin()}
              >
                登录 OneKey ID
              </Button>
            </YStack>
            <YStack flex={1} minWidth={0} gap="$6">
              <YStack gap="$3">
                <SizableText size="$headingMd">可享补贴</SizableText>
                <YStack gap="$3">
                  {tronCard}
                  {multichainCard}
                </YStack>
              </YStack>
              <GuestUsageGuide compact />
            </YStack>
          </XStack>
        </ScrollView>
      );
    }
    if (wide) {
      let detail;
      let detailTitle: string | undefined;
      switch (activePanel) {
        case 'tron':
          detailTitle = 'TRON 免费能量';
          detail = (
            <TronClaimView details={claimDetails ?? loadingClaimDetails} />
          );
          break;
        case 'multichain':
          detailTitle = multichainBenefit.title;
          detail = <MultichainDetails />;
          break;
        case 'history':
          detailTitle = subsidyRecordsCopy.title;
          detail = <SubsidyRecordsPanel compact query={historyQuery} />;
          break;
        case 'help':
          detailTitle = intl.formatMessage({ id: ETranslations.global_faqs });
          detail = (
            <YStack pl="$3" pr="$2" py="$1">
              <SubsidyFAQ />
            </YStack>
          );
          break;
      }
      return (
        <DesktopSubsidyLayout
          detailTitle={detailTitle}
          totalLabel={summaryCopy.totalLabel}
          total={
            <SubsidyTotalAmount
              query={summaryQuery}
              size="$heading4xl"
              fontVariant={['tabular-nums']}
            />
          }
          summary={<SubsidySummaryStats compact query={summaryQuery} />}
          benefitCards={
            <>
              {tronCard}
              {multichainCard}
            </>
          }
          activePanel={activePanel}
          onSelectPanel={setPanel}
        >
          {detail}
        </DesktopSubsidyLayout>
      );
    }
    return (
      <>
        {tronCard}
        {signedIn && claimDetails ? (
          <TronClaimView
            dialog={{
              open: claimDialogOpen,
              onClose: () => setClaimDialogOpen(false),
            }}
            details={claimDetails}
          />
        ) : null}
      </>
    );
  };

  let benefitsContent;
  if (signedIn) {
    benefitsContent = (
      <TronRewardCenterContent
        params={{
          // An entry that names an account claims for it; the "More" entry
          // names none and follows the wallet's current account.
          accountId: routeParams?.accountId || account?.id || '',
          networkId: routeParams?.networkId || network?.id || '',
          walletId: routeParams?.walletId || wallet?.id,
          showAccountSelector: routeParams?.showAccountSelector,
          onClose: routeParams?.onClose,
        }}
        renderLoading={renderSubsidyBenefits}
        renderInline={renderSubsidyBenefits}
        onIssued={refreshRecords}
      />
    );
  } else {
    benefitsContent = renderSubsidyBenefits();
  }

  return (
    <Page backgroundColor={pageBackgroundColor} onMounted={handlePageMounted}>
      <Page.Header
        headerContainerBackgroundColor={headerBackgroundColor}
        headerStyle={headerStyle}
        title="补贴中心"
      />
      <Page.Body>
        {wide ? (
          benefitsContent
        ) : (
          <ScrollView flex={1}>
            <YStack
              width="100%"
              maxWidth={960}
              alignSelf="center"
              px="$5"
              pt={signedIn ? '$2' : 0}
              pb="$5"
              gap="$6"
            >
              {overview}

              <YStack gap="$3">
                <SizableText size="$headingMd">
                  {signedIn ? '我的补贴' : '可享补贴'}
                </SizableText>
                {benefitsContent}
                {multichainCard}
              </YStack>

              {signedIn ? (
                <YStack gap="$3">
                  <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <SizableText size="$headingMd">
                      {subsidyRecordsCopy.title}
                    </SizableText>
                    {(historyQuery.data?.items.length ?? 0) >
                    SUBSIDY_RECENT_RECORD_LIMIT ? (
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
                        onPress={() =>
                          navigation.push(
                            EModalRewardCenterRoutes.SubsidyHistory,
                          )
                        }
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
                    ) : null}
                  </XStack>
                  <SubsidyRecentRecords query={historyQuery} />
                </YStack>
              ) : null}

              {signedIn ? (
                <YStack gap="$2">
                  <SizableText size="$headingMd">
                    {intl.formatMessage({ id: ETranslations.global_faqs })}
                  </SizableText>
                  <SubsidyFAQ />
                </YStack>
              ) : (
                <GuestUsageGuide />
              )}
            </YStack>
          </ScrollView>
        )}
      </Page.Body>
    </Page>
  );
}

export default function SubsidyCenterModal() {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <SubsidyCenter />
    </AccountSelectorProviderMirror>
  );
}
