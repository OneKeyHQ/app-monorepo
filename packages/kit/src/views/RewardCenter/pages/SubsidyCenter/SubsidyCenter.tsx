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
import {
  TronRewardCenterContent,
  getCachedTronPool,
} from '@onekeyhq/kit/src/views/RewardCenter/pages/RewardCenter';
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
  SubsidyRecordsPaged,
  SubsidySummaryLoadFailed,
  subsidyRecordsCopy,
} from './SubsidyRecords';
import {
  SUBSIDY_RECENT_RECORD_LIMIT,
  formatSubsidyCount,
} from './subsidyRecordUtils';
import { TronClaimView, subsidyDialogProps } from './TronClaimDialog';
import {
  getSubsidyMemberId,
  refreshSubsidyRecords,
  useSubsidyIdentity,
  useSubsidyRecentHistory,
  useSubsidySummary,
} from './useSubsidyRecords';

import type { ISubsidyPanel } from './DesktopSubsidyLayout';
import type { ISubsidySummaryView } from './subsidyRecordUtils';
import type { ISubsidyQuery } from './useSubsidyRecords';
import type { RouteProp } from '@react-navigation/core';

const loginRequiredLabel = ETranslations.subsidy_login_required__title;

const multichainBenefit = {
  title: ETranslations.subsidy_multichain__title,
  networks: ['Ethereum', 'Arbitrum', 'Base', 'BSC', 'Polygon', 'Robinhood'],
  scope: ETranslations.subsidy_eligible_operations__desc,
  rules: [
    ETranslations.subsidy_signin_rules__desc,
    ETranslations.subsidy_coverage_rules__desc,
  ],
};

const subsidyFAQs = [
  {
    question: ETranslations.subsidy_faq_claim__title,
    answer: ETranslations.subsidy_faq_claim__desc,
  },
  {
    question: ETranslations.subsidy_faq_unavailable__title,
    answer: ETranslations.subsidy_faq_unavailable__desc,
  },
  {
    question: ETranslations.subsidy_faq_multichain__title,
    answer: ETranslations.subsidy_faq_multichain__desc,
  },
  {
    question: ETranslations.subsidy_faq_fees__title,
    answer: ETranslations.subsidy_faq_fees__desc,
  },
];

const summaryCopy = {
  totalLabel: ETranslations.subsidy_total__title,
  gaSettledLabel: ETranslations.subsidy_transaction_count__title,
  tronAcceptedLabel: ETranslations.subsidy_energy_count__title,
};

const usageSteps = [
  {
    title: ETranslations.sign_in_to_onekey_id__title,
    shortDescription: ETranslations.subsidy_guide_signin_short__desc,
    description: ETranslations.subsidy_guide_signin__desc,
  },
  {
    title: ETranslations.subsidy_guide_claim__title,
    shortDescription: ETranslations.subsidy_guide_claim_short__desc,
    description: ETranslations.subsidy_guide_claim__desc,
  },
  {
    title: ETranslations.subsidy_guide_transact__title,
    shortDescription: ETranslations.subsidy_guide_transact_short__desc,
    description: ETranslations.subsidy_guide_transact__desc,
  },
];

function GuestUsageGuide({ compact = false }: { compact?: boolean }) {
  const intl = useIntl();
  const stepSpacing = compact ? '$3' : '$5';
  return (
    <YStack gap={compact ? '$5' : '$4'}>
      <SizableText size="$headingMd">
        {intl.formatMessage({ id: ETranslations.subsidy_guide__title })}
      </SizableText>
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
                {intl.formatMessage({ id: step.title })}
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
                  {intl.formatMessage({
                    id: compact ? step.shortDescription : step.description,
                  })}
                </SizableText>
              </YStack>
            </XStack>
          </YStack>
        ))}
      </YStack>
    </YStack>
  );
}

// The summary view maps a null sponsor cost to zero while keeping a missing
// response unknown.
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
          --
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
    return <SizableText {...textProps}>--</SizableText>;
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
  const intl = useIntl();
  const summaryStats = [
    {
      label: intl.formatMessage({ id: summaryCopy.gaSettledLabel }),
      value: formatSubsidyCount(query.data?.gaSettledCount),
    },
    {
      label: intl.formatMessage({ id: summaryCopy.tronAcceptedLabel }),
      value: formatSubsidyCount(query.data?.tronAcceptedCount),
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
    <XStack gap="$4" alignItems="flex-start" py="$3">
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        flex={2}
        flexBasis={0}
        minWidth={0}
      >
        {label}
      </SizableText>
      <SizableText
        size="$bodyMdMedium"
        flex={3}
        flexBasis={0}
        minWidth={0}
        textAlign="right"
      >
        {value}
      </SizableText>
    </XStack>
  );
}

function MultichainDetails() {
  const intl = useIntl();
  return (
    <YStack gap="$5" testID="subsidy-drawer-multichain">
      <YStack>
        <DetailRow
          label={intl.formatMessage({
            id: ETranslations.subsidy_networks__title,
          })}
          value={multichainBenefit.networks.join(', ')}
        />
        <DetailRow
          label={intl.formatMessage({
            id: ETranslations.subsidy_operations__title,
          })}
          value={intl.formatMessage({ id: multichainBenefit.scope })}
        />
      </YStack>
      <YStack gap="$3">
        <SizableText size="$headingSm">
          {intl.formatMessage({
            id: ETranslations.subsidy_instructions__title,
          })}
        </SizableText>
        {multichainBenefit.rules.map((rule) => (
          <SizableText key={rule} size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: rule })}
          </SizableText>
        ))}
      </YStack>
    </YStack>
  );
}

function SubsidyFAQ() {
  const intl = useIntl();
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
                  {intl.formatMessage({ id: question })}
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
                {intl.formatMessage({ id: answer })}
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
  const historyQuery = useSubsidyRecentHistory(identity);
  // Records in the 90-day window: a number, or unknown while loading or when
  // the server could not count them (then the count is simply not shown).
  const recordTotal =
    typeof historyQuery.data?.total === 'number'
      ? historyQuery.data.total
      : undefined;
  const hasMoreRecords =
    recordTotal === undefined
      ? Boolean(historyQuery.data?.hasMore)
      : recordTotal > SUBSIDY_RECENT_RECORD_LIMIT;
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
  // A claim or redemption adds a record and can change the totals: the
  // summary, the recent records and an open record list of the member it was
  // issued to reload. The request can outlive this page and the session, so
  // the member is bound into the callback the request starts with, not read
  // when it completes.
  const handleIssued = useCallback(
    () => refreshSubsidyRecords(identity),
    [identity],
  );
  // What the claim panel shows until the account is resolved: the same
  // structure as the loaded panel, so it settles in place instead of
  // replacing a single placeholder line. Today's pool is shared by every
  // address, so once it is known (any earlier open in this session) it is
  // shown from the first frame; only the first open has nothing to show.
  const cachedPool = getCachedTronPool(routeParams?.networkId || network?.id);
  const loadingClaimDetails = useMemo<ITronRewardCardState['claimDetails']>(
    () => ({
      remaining: cachedPool?.remaining,
      total: cachedPool?.total,
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
    [intl, cachedPool?.remaining, cachedPool?.total],
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
      title: intl.formatMessage({ id: multichainBenefit.title }),
      ...subsidyDialogProps,
      onConfirmText: signedIn
        ? intl.formatMessage({ id: ETranslations.global_got_it })
        : intl.formatMessage({ id: ETranslations.sign_in_to_onekey_id__title }),
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

  let summaryStats = null;
  if (platformEnv.isDesktop || platformEnv.isWeb) {
    if (summaryQuery.isError) {
      summaryStats = (
        <SubsidySummaryLoadFailed
          compact={wide}
          onRetry={summaryQuery.reload}
        />
      );
    }
  } else {
    summaryStats = <SubsidySummaryStats compact={wide} query={summaryQuery} />;
  }

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
          {intl.formatMessage({ id: summaryCopy.totalLabel })}
        </SizableText>
      </YStack>
      {summaryStats}
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
          {intl.formatMessage({
            id: ETranslations.subsidy_signin_benefit__title,
          })}
        </SizableText>
        <Button
          testID="subsidy-login"
          variant="accent"
          size="large"
          onPress={() => showLogin()}
        >
          {intl.formatMessage({
            id: ETranslations.sign_in_to_onekey_id__title,
          })}
        </Button>
      </YStack>
    </YStack>
  );
  const multichainActionLabel = signedIn
    ? intl.formatMessage({ id: ETranslations.global_details })
    : intl.formatMessage({ id: loginRequiredLabel });
  const multichainCard = (
    <BenefitCard
      testID="subsidy-detail-multichain"
      listRow={wide}
      selected={wide && signedIn ? activePanel === 'multichain' : undefined}
      title={intl.formatMessage({ id: multichainBenefit.title })}
      description={
        signedIn
          ? intl.formatMessage({
              id: ETranslations.subsidy_eligible_transfers__desc,
            })
          : intl.formatMessage({
              id: ETranslations.subsidy_selected_transfers__desc,
            })
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
    let description = signedIn
      ? intl.formatMessage({
          id: ETranslations.subsidy_daily_per_address__desc,
        })
      : intl.formatMessage({ id: ETranslations.subsidy_daily_limit__desc });
    let actionLabel = signedIn
      ? intl.formatMessage({ id: ETranslations.subsidy_claim__action })
      : intl.formatMessage({ id: loginRequiredLabel });
    if (claimed) {
      const notice = validUntil
        ? intl.formatMessage(
            { id: ETranslations.subsidy_claimed_until__desc },
            {
              time: intl.formatTime(validUntil, {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          )
        : intl.formatMessage({
            id: ETranslations.subsidy_claimed_today__title,
          });
      description = [accountName, notice].filter(Boolean).join(' · ');
      actionLabel = intl.formatMessage({
        id: ETranslations.subsidy_claimed__title,
      });
    } else if (exhausted) {
      description = intl.formatMessage({
        id: ETranslations.subsidy_code_available__desc,
      });
      actionLabel = intl.formatMessage({
        id: ETranslations.wallet_subsidy_all_used,
      });
    }
    const tronCard = (
      <BenefitCard
        cardTestID="subsidy-tron-energy"
        testID="subsidy-tron-claim"
        listRow={wide}
        selected={wide && signedIn ? activePanel === 'tron' : undefined}
        title={intl.formatMessage({
          id: ETranslations.subsidy_tron_energy__title,
        })}
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
                {intl.formatMessage({
                  id: ETranslations.subsidy_signin_benefit__title,
                })}
              </SizableText>
              <Button
                testID="subsidy-login"
                variant="accent"
                size="large"
                width="100%"
                maxWidth={216}
                onPress={() => showLogin()}
              >
                {intl.formatMessage({
                  id: ETranslations.sign_in_to_onekey_id__title,
                })}
              </Button>
            </YStack>
            <YStack flex={1} minWidth={0} gap="$6">
              <YStack gap="$3">
                <SizableText size="$headingMd">
                  {intl.formatMessage({
                    id: ETranslations.subsidy_available__title,
                  })}
                </SizableText>
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
          detailTitle = intl.formatMessage({
            id: ETranslations.subsidy_tron_energy__title,
          });
          detail = (
            <TronClaimView details={claimDetails ?? loadingClaimDetails} />
          );
          break;
        case 'multichain':
          detailTitle = intl.formatMessage({ id: multichainBenefit.title });
          detail = <MultichainDetails />;
          break;
        case 'history':
          detailTitle = intl.formatMessage({ id: subsidyRecordsCopy.title });
          detail = <SubsidyRecordsPaged compact identity={identity} />;
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
          totalLabel={intl.formatMessage({ id: summaryCopy.totalLabel })}
          total={
            <SubsidyTotalAmount
              query={summaryQuery}
              size="$heading4xl"
              fontVariant={['tabular-nums']}
            />
          }
          summary={summaryStats}
          recordCount={recordTotal}
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
        onekeyUserId={getSubsidyMemberId(identity)}
        onIssued={handleIssued}
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
        title={intl.formatMessage({ id: ETranslations.subsidy_center__title })}
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
                  {signedIn
                    ? intl.formatMessage({
                        id: ETranslations.subsidy_my_benefits__title,
                      })
                    : intl.formatMessage({
                        id: ETranslations.subsidy_available__title,
                      })}
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
                      {intl.formatMessage({ id: subsidyRecordsCopy.title })}
                    </SizableText>
                    {hasMoreRecords ? (
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
                            {intl.formatMessage({
                              id: ETranslations.global_view_more,
                            })}
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
