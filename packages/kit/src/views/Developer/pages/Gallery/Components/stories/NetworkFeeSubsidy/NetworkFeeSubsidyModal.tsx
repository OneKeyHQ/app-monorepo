import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Accordion,
  Button,
  Dialog,
  Icon,
  Page,
  Pagination,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useInModalDialog,
  useMedia,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorProvider';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { showOneKeyIdLoginFailedToast } from '@onekeyhq/kit/src/views/Prime/components/oneKeyIdLoginToastUtils';
import type { ITronRewardCardState } from '@onekeyhq/kit/src/views/RewardCenter/pages/RewardCenter';
import { TronRewardCenterContent } from '@onekeyhq/kit/src/views/RewardCenter/pages/RewardCenter';
import { useSettingsPageStyle } from '@onekeyhq/kit/src/views/Setting/pages/Tab/useSettingsPageStyle';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  DesktopSubsidyLayout,
  desktopSubsidySidebarWidth,
} from './DesktopSubsidyLayout';
import { EnergyArtwork } from './EnergyArtwork';
import { SubsidyPreviewMenu, TronRewardPreview } from './SubsidyPreview';
import { TronClaimView, subsidyDialogProps } from './TronClaimDialog';

import type { ISubsidyPanel } from './DesktopSubsidyLayout';
import type { ISubsidyPreviewMode } from './SubsidyPreview';

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

type ISubsidyRecord = {
  title: string;
  network: 'TRON' | 'Base';
  timestamp: string;
  saved: number;
  icon: IKeyOfIcons;
};

function demoRecord(
  network: ISubsidyRecord['network'],
  timestamp: string,
  saved: number,
): ISubsidyRecord {
  const isTron = network === 'TRON';
  return {
    title: isTron ? 'USDT 转账' : 'USDC 转账',
    network,
    timestamp,
    saved,
    icon: isTron ? 'FlashSolid' : 'GasOutline',
  };
}

const records = [
  demoRecord('TRON', '2026-11-10T02:24:00Z', 1.24),
  demoRecord('Base', '2026-11-09T10:06:00Z', 0.08),
  demoRecord('TRON', '2026-11-09T01:41:00Z', 1.18),
  demoRecord('Base', '2026-11-08T11:52:00Z', 0.12),
  demoRecord('TRON', '2026-11-08T04:17:00Z', 1.2),
  demoRecord('Base', '2026-11-07T07:38:00Z', 0.18),
  demoRecord('TRON', '2026-11-07T00:53:00Z', 1.18),
  demoRecord('Base', '2026-11-06T09:12:00Z', 0.22),
  demoRecord('TRON', '2026-11-06T03:46:00Z', 1.24),
  demoRecord('Base', '2026-11-05T12:21:00Z', 0.09),
  demoRecord('TRON', '2026-11-05T05:09:00Z', 1.22),
  demoRecord('Base', '2026-11-04T08:34:00Z', 0.14),
  demoRecord('TRON', '2026-11-04T02:58:00Z', 1.26),
  demoRecord('Base', '2026-11-03T10:43:00Z', 0.16),
  demoRecord('TRON', '2026-11-03T06:15:00Z', 1.19),
  demoRecord('Base', '2026-11-02T13:07:00Z', 0.25),
  demoRecord('TRON', '2026-11-02T01:32:00Z', 1.21),
  demoRecord('Base', '2026-11-01T08:49:00Z', 0.7),
];

const totalSaved = records.reduce((total, record) => total + record.saved, 0);
const summaryStats = [
  { label: '已补贴交易', value: `${records.length} 笔` },
  { label: '补贴类型', value: '2 项' },
];

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
      <SizableText
        size={compact ? '$headingSm' : '$headingMd'}
        color={compact ? '$textSubdued' : '$text'}
      >
        操作说明
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

function SubsidyRecordList({
  items,
  rowHeight,
}: {
  items: ISubsidyRecord[];
  rowHeight?: number;
}) {
  const headingSize = rowHeight === undefined ? '$headingMd' : '$headingSm';
  return (
    <YStack
      {...(rowHeight === undefined && {
        gap: '$6',
        p: '$4',
        bg: '$bgSubdued',
        borderRadius: '$6',
        borderCurve: 'continuous',
        overflow: 'hidden',
      })}
    >
      {items.map((record) => (
        <XStack
          key={record.timestamp}
          minHeight={rowHeight}
          alignItems="center"
          gap="$3"
        >
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
              <SizableText size={headingSize} flex={1}>
                {record.title}
              </SizableText>
              <SizableText
                size={headingSize}
                color="$textSuccess"
                flexShrink={0}
              >
                ${record.saved.toFixed(2)}
              </SizableText>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {record.network} ·{' '}
              {formatDate(record.timestamp, { hideTimeForever: true })}
            </SizableText>
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

function DesktopSubsidyHistory() {
  const rowHeight = 52;
  const [pageSize, setPageSize] = useState(1);
  const [recordIndex, setRecordIndex] = useState(0);
  const current = Math.floor(recordIndex / pageSize) + 1;
  const start = (current - 1) * pageSize;
  const total = Math.ceil(records.length / pageSize);

  return (
    <YStack flex={1} minHeight={0} gap="$3">
      <YStack
        flex={1}
        minHeight={0}
        onLayout={({ nativeEvent }) =>
          setPageSize(
            Math.max(1, Math.floor(nativeEvent.layout.height / rowHeight)),
          )
        }
      >
        <SubsidyRecordList
          items={records.slice(start, start + pageSize)}
          rowHeight={rowHeight}
        />
      </YStack>
      {total > 1 ? (
        <Pagination
          alignSelf="flex-end"
          flexShrink={0}
          current={current}
          total={total}
          siblingCount={0}
          onChange={(page) => setRecordIndex((page - 1) * pageSize)}
          testID="subsidy-desktop-history-pagination"
        />
      ) : null}
    </YStack>
  );
}

function SubsidySummaryStats() {
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

function NetworkFeeSubsidy() {
  const intl = useIntl();
  const { isLoggedIn, loginOneKeyId } = useOneKeyAuth();
  const [previewMode, setPreviewMode] = useState<ISubsidyPreviewMode>('live');
  const [previewSession, setPreviewSession] = useState(0);
  const [previewValidUntil, setPreviewValidUntil] = useState<number>();
  const signedIn =
    previewMode === 'live' ? Boolean(isLoggedIn) : previewMode !== 'guest';
  const { gtMd } = useMedia();
  const wide = Boolean(
    gtMd &&
    (platformEnv.isDesktop || platformEnv.isWeb || platformEnv.isExtension),
  );
  const desktopGuest = wide && !signedIn;
  const { pageBackgroundColor, headerStyle, headerBackgroundColor } =
    useSettingsPageStyle(wide);
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
  const selectPreview = useCallback((mode: ISubsidyPreviewMode) => {
    setPreviewMode(mode);
    setPreviewValidUntil(
      mode === 'claimed' ? Date.now() + 10 * 60_000 : undefined,
    );
  }, []);
  const openPreview = useCallback(
    (mode: ISubsidyPreviewMode) => {
      selectPreview(mode);
      setPreviewSession((session) => session + 1);
      setPanel('tron');
      setClaimDialogOpen(!wide && mode !== 'guest' && mode !== 'live');
    },
    [selectPreview, wide],
  );
  const renderPreviewMenu = useCallback(
    () => <SubsidyPreviewMenu mode={previewMode} onSelect={openPreview} />,
    [previewMode, openPreview],
  );
  const showLogin = async (onSuccess?: () => void) => {
    if (previewMode === 'guest') {
      selectPreview('available');
      onSuccess?.();
      return;
    }
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
        <SizableText
          size="$heading4xl"
          fontSize={40}
          lineHeight={48}
          textAlign="center"
        >
          ${totalSaved.toFixed(2)}
        </SizableText>
        <SizableText
          size="$bodyXs"
          color="$textDisabled"
          letterSpacing={1.2}
          textAlign="center"
        >
          累计获得补贴（演示）
        </SizableText>
      </YStack>
      <SubsidySummaryStats />
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
    claimDetails,
  }: Partial<ITronRewardCardState> = {}) => {
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
              bg="$bg"
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
            <YStack
              flex={1}
              minWidth={0}
              gap="$8"
              py="$3"
              justifyContent="center"
            >
              <YStack gap="$3">
                <SizableText size="$headingSm" color="$textSubdued">
                  可享补贴
                </SizableText>
                {tronCard}
                {multichainCard}
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
          detail = claimDetails ? (
            <TronClaimView details={claimDetails} />
          ) : (
            <Skeleton.BodyLg />
          );
          break;
        case 'multichain':
          detailTitle = multichainBenefit.title;
          detail = <MultichainDetails />;
          break;
        case 'history':
          detailTitle = '补贴记录';
          detail = <DesktopSubsidyHistory />;
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
          totalSaved={totalSaved}
          recordCount={records.length}
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
  if (previewMode !== 'live' && previewMode !== 'guest') {
    benefitsContent = (
      <TronRewardPreview
        key={previewSession}
        mode={previewMode}
        validUntil={previewValidUntil}
        onModeChange={selectPreview}
        renderInline={renderSubsidyBenefits}
      />
    );
  } else if (signedIn) {
    benefitsContent = (
      <TronRewardCenterContent
        params={{
          accountId: account?.id ?? '',
          networkId: network?.id ?? '',
          walletId: wallet?.id,
        }}
        renderLoading={wide ? renderSubsidyBenefits : undefined}
        renderInline={renderSubsidyBenefits}
      />
    );
  } else {
    benefitsContent = renderSubsidyBenefits();
  }

  return (
    <Page backgroundColor={pageBackgroundColor}>
      <Page.Header
        headerContainerBackgroundColor={headerBackgroundColor}
        headerStyle={headerStyle}
        title="补贴中心"
        headerRight={renderPreviewMenu}
        headerRightNoGlass
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
                      补贴记录（演示）
                    </SizableText>
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
                          title: '全部补贴记录（演示）',
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

export default function NetworkFeeSubsidyModal() {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <NetworkFeeSubsidy />
    </AccountSelectorProviderMirror>
  );
}
