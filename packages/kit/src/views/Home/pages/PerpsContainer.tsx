import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  DashText,
  Empty,
  Icon,
  Image,
  SegmentControl,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  OVERVIEW_TILE_SHADOW,
  buildOverviewGridStyle,
} from '../components/DeFiListBlock/DeFiOverviewLayout';
import { resolveOverviewCols } from '../components/DeFiListBlock/overviewColsResolver';
import { RichBlock } from '../components/RichBlock';
import { HomeTestIDs } from '../testIDs';

type IPerpsMockHolding = {
  symbol: string;
  value: string;
  balance: string;
  pnl?: string;
};

type IPerpsMockPosition = {
  coin: string;
  side: 'long' | 'short';
  leverageType: 'isolated' | 'cross';
  leverage: string;
  pnl: string;
  roi: string;
  size: string;
  margin: string;
  entryPrice: string;
  fundingFee: string;
  markPrice: string;
  liqPrice: string;
};

type IPerpsMockViewState = 'ready' | 'loading' | 'empty';

const getMockPerpsViewState = (): IPerpsMockViewState => 'ready';
const PERPS_MOCK_VIEW_STATE_OPTIONS: {
  value: IPerpsMockViewState;
  label: string;
}[] = [
  { value: 'ready', label: '正常' },
  { value: 'loading', label: 'Loading' },
  { value: 'empty', label: '空' },
];

const MOCK_PERPS_HOLDINGS: IPerpsMockHolding[] = [
  { symbol: 'USDC', value: '$82.45', balance: '82.45', pnl: '--' },
  { symbol: 'HYPE', value: '$28.16', balance: '1.24', pnl: '+$1.02' },
  { symbol: 'ETH', value: '$18.04', balance: '0.0056', pnl: '+$0.48' },
  { symbol: 'BTC', value: '$12.38', balance: '0.00012', pnl: '--' },
  { symbol: 'SOL', value: '$5.62', balance: '0.83', pnl: '-$0.12' },
];

const MOCK_PERPS_POSITIONS: IPerpsMockPosition[] = [
  {
    coin: 'ETH',
    side: 'long',
    leverageType: 'isolated',
    leverage: '1x',
    pnl: '+$10.12',
    roi: '+10%',
    size: '1.2',
    margin: '$100.12',
    entryPrice: '$1,600.12',
    fundingFee: '-$0.01',
    markPrice: '$1,600.12',
    liqPrice: '$1,600.12',
  },
  {
    coin: 'ETH',
    side: 'short',
    leverageType: 'isolated',
    leverage: '1x',
    pnl: '+$10.12',
    roi: '+10%',
    size: '$500.12',
    margin: '$100.12',
    entryPrice: '$1,600.12',
    fundingFee: '-$0.01',
    markPrice: '$1,600.12',
    liqPrice: '$1,600.12',
  },
];
const MOCK_PERPS_ACCOUNT_VALUE = '$146.65';
const HYPER_EVM_LOGO_URI =
  'https://uni.onekey-asset.com/static/chain/hyper-evm.png';
const SPAN_1: React.CSSProperties = { gridColumnEnd: 'span 1' };
const noop = () => undefined;

function PerpsHoldingCard({
  holding,
  hyperEvmLogoUri,
}: {
  holding: IPerpsMockHolding;
  hyperEvmLogoUri: string;
}) {
  return (
    <XStack
      flex={1}
      bg="$bgSubdued"
      borderRadius="$3"
      px="$3"
      py="$2.5"
      alignItems="center"
      gap="$2.5"
      cursor="default"
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
      }}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      $platform-web={{ boxShadow: OVERVIEW_TILE_SHADOW }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      onPress={noop}
      role="button"
    >
      <Stack
        width={36}
        height={36}
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
      >
        <Stack
          width={32}
          height={32}
          borderRadius="$full"
          bg="$bgApp"
          alignItems="center"
          justifyContent="center"
          position="relative"
        >
          <Token
            size="md"
            tokenImageUri={getHyperliquidTokenImageUrl(holding.symbol)}
          />
          <Stack
            position="absolute"
            right="$-1"
            bottom="$-1"
            p="$0.5"
            bg="$bgApp"
            borderRadius="$full"
          >
            <Image
              source={{ uri: hyperEvmLogoUri }}
              w="$3.5"
              h="$3.5"
              borderRadius="$full"
            />
          </Stack>
        </Stack>
      </Stack>
      <YStack flex={1} minWidth={0} gap="$1">
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {holding.symbol}
        </SizableText>
        <SizableText size="$bodyLgMedium" color="$text" numberOfLines={1}>
          {holding.value}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function PerpsHoldingsBlock({ hyperEvmLogoUri }: { hyperEvmLogoUri: string }) {
  const media = useMedia();
  const cols = useMemo(
    () =>
      resolveOverviewCols({
        gtXl: media.gtXl,
        gtLg: media.gtLg,
      }),
    [media.gtLg, media.gtXl],
  );

  return (
    <XStack
      width="100%"
      gap="$4"
      rowGap="$5"
      style={buildOverviewGridStyle(cols)}
      py="$2"
    >
      {MOCK_PERPS_HOLDINGS.map((holding) => (
        <XStack key={holding.symbol} minWidth={0} style={SPAN_1}>
          <PerpsHoldingCard
            holding={holding}
            hyperEvmLogoUri={hyperEvmLogoUri}
          />
        </XStack>
      ))}
    </XStack>
  );
}

function PerpsHoldingsSkeletonBlock() {
  const media = useMedia();
  const cols = useMemo(
    () =>
      resolveOverviewCols({
        gtXl: media.gtXl,
        gtLg: media.gtLg,
      }),
    [media.gtLg, media.gtXl],
  );

  return (
    <XStack
      width="100%"
      gap="$4"
      rowGap="$5"
      style={buildOverviewGridStyle(cols)}
      py="$2"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <XStack key={index} minWidth={0} style={SPAN_1}>
          <XStack
            bg="$bgSubdued"
            borderRadius="$3"
            px="$3"
            py="$2.5"
            gap="$2.5"
            alignItems="center"
            width="100%"
            minHeight={72}
          >
            <Skeleton w="$8" h="$8" radius="round" />
            <YStack gap="$2" flex={1}>
              <Skeleton.BodyMd />
              <Skeleton.BodyLg />
            </YStack>
          </XStack>
        </XStack>
      ))}
    </XStack>
  );
}

function PerpsPositionSkeletonCard() {
  return (
    <YStack
      py="$4"
      $gtMd={{
        bg: '$bgSubdued',
        borderRadius: '$3',
        px: '$4',
        py: '$4',
      }}
      gap="$4"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2" alignItems="center">
          <Skeleton w="$4" h="$4" />
          <Skeleton.BodyLg w={80} />
          <Skeleton.BodySm w={48} />
        </XStack>
        <Skeleton w="$4" h="$4" />
      </XStack>
      <XStack justifyContent="space-between">
        <Skeleton.BodyLg w={96} />
        <Skeleton.BodyLg w={72} />
      </XStack>
      <XStack justifyContent="space-between">
        <Skeleton.BodyMd w={100} />
        <Skeleton.BodyMd w={88} />
        <Skeleton.BodyMd w={104} />
      </XStack>
      <XStack justifyContent="space-between">
        <Skeleton.BodyMd w={80} />
        <Skeleton.BodyMd w={88} />
        <Skeleton.BodyMd w={104} />
      </XStack>
    </YStack>
  );
}

function PerpsLoadingState() {
  return (
    <>
      <YStack display="flex" $gtMd={{ display: 'none' }} gap="$3" py="$2">
        <XStack alignItems="center" justifyContent="space-between" gap="$4">
          <XStack flex={1} minWidth={0} alignItems="center" gap="$1">
            <Skeleton.HeadingXl w={112} />
          </XStack>
          <Skeleton w={72} h={28} borderRadius="$full" />
        </XStack>
        <YStack gap="$0.5">
          <XStack alignItems="center" gap="$3" pt="$1.5">
            <XStack flexGrow={1} flexBasis={0}>
              <Skeleton.BodySm w={80} />
            </XStack>
            <XStack flexGrow={1} flexBasis={0} justifyContent="flex-end">
              <Skeleton.BodySm w={80} />
            </XStack>
          </XStack>
          {Array.from({ length: 2 }).map((_, index) => (
            <XStack
              key={index}
              py="$2"
              alignItems="center"
              justifyContent="space-between"
              gap="$3"
            >
              <XStack flex={1} minWidth={0} alignItems="center" gap="$3">
                <Skeleton w="$10" h="$10" radius="round" />
                <YStack flex={1} gap="$2">
                  <Skeleton.BodyLg />
                  <Skeleton.BodyMd />
                </YStack>
              </XStack>
              <YStack alignItems="flex-end" gap="$2">
                <Skeleton.BodyLg w={72} />
                <Skeleton.BodyMd w={48} />
              </YStack>
            </XStack>
          ))}
        </YStack>
      </YStack>
      <YStack display="none" $gtMd={{ display: 'flex' }}>
        <RichBlock
          withTitleSeparator
          title={<Skeleton.BodyLg w={120} />}
          subTitle={<Skeleton.HeadingXl w={120} />}
          headerContainerProps={{ px: 0, pb: 0 }}
          headerActions={
            <XStack alignItems="center" gap="$2">
              <Skeleton w={84} h={28} borderRadius="$full" />
              <Skeleton w={64} h={28} borderRadius="$full" />
            </XStack>
          }
          content={null}
          plainContentContainer
        />
        <PerpsHoldingsSkeletonBlock />
      </YStack>
      <YStack gap="$3">
        {Array.from({ length: 2 }).map((_, index) => (
          <PerpsPositionSkeletonCard key={index} />
        ))}
      </YStack>
    </>
  );
}

function PerpsEmptyState() {
  const intl = useIntl();

  return (
    <>
      <YStack display="flex" $gtMd={{ display: 'none' }} gap="$3" py="$2">
        <XStack alignItems="center" justifyContent="space-between" gap="$4">
          <XStack flex={1} minWidth={0} alignItems="center" gap="$1">
            <SizableText size="$headingXl" color="$text" numberOfLines={1}>
              {intl.formatMessage({ id: ETranslations.global_perp })}
            </SizableText>
            <SizableText size="$headingXl" color="$textSubdued">
              ·
            </SizableText>
            <SizableText
              size="$headingXl"
              color="$textSubdued"
              numberOfLines={1}
            >
              $0.00
            </SizableText>
          </XStack>
          <PerpsDepositButton testID={HomeTestIDs.perpsDepositButton} />
        </XStack>
      </YStack>
      <YStack display="none" $gtMd={{ display: 'flex' }}>
        <RichBlock
          withTitleSeparator
          title={intl.formatMessage({
            id: ETranslations.perp_account_panel_account_value,
          })}
          subTitle="$0.00"
          headerContainerProps={{ px: 0, pb: 0 }}
          headerActions={<PerpsHeaderActions />}
          content={null}
          plainContentContainer
        />
      </YStack>
      <Empty
        py="$8"
        illustration="Orders"
        title={intl.formatMessage({
          id: ETranslations.perp_position_empty,
        })}
        description={intl.formatMessage({
          id: ETranslations.perp_position_empty_desc,
        })}
      />
    </>
  );
}

function PerpsMockStateSwitch({
  value,
  onChange,
}: {
  value: IPerpsMockViewState;
  onChange: (value: IPerpsMockViewState) => void;
}) {
  return (
    <XStack display="flex" justifyContent="flex-end" pt="$3">
      <SegmentControl
        h={32}
        value={value}
        options={PERPS_MOCK_VIEW_STATE_OPTIONS.map((option) => ({
          label: option.label,
          value: option.value,
          testID: `${HomeTestIDs.perpsMockStateButton}-${option.value}`,
        }))}
        onChange={(nextValue) => onChange(nextValue as IPerpsMockViewState)}
      />
    </XStack>
  );
}

function getPnlColor(pnl?: string) {
  if (!pnl || pnl === '--') {
    return '$textSubdued';
  }
  return pnl.startsWith('-') ? '$red11' : '$green11';
}

function PerpsDepositButton({ testID }: { testID: string }) {
  const intl = useIntl();

  return (
    <Badge
      testID={testID}
      borderRadius="$full"
      size="medium"
      variant="primary"
      alignItems="center"
      justifyContent="center"
      flexDirection="row"
      gap="$2"
      px="$3"
      h={28}
      bg="$brand8"
    >
      <Icon name="AlignBottomOutline" size="$4" color="$iconOnColor" />
      <SizableText size="$bodySmMedium" color="$textOnColor">
        {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
      </SizableText>
    </Badge>
  );
}

function PerpsHeaderActions() {
  const intl = useIntl();

  return (
    <XStack alignItems="center" gap="$2">
      <PerpsDepositButton testID={HomeTestIDs.perpsDesktopDepositButton} />
      <Button
        size="medium"
        variant="secondary"
        childrenAsText={false}
        testID={HomeTestIDs.perpsManageButton}
      >
        <SizableText size="$bodySmMedium">
          {intl.formatMessage({
            id: ETranslations.global_manage,
          })}
        </SizableText>
      </Button>
    </XStack>
  );
}

function PerpsMobileHoldingRow({ holding }: { holding: IPerpsMockHolding }) {
  return (
    <XStack py="$2" alignItems="center" justifyContent="space-between" gap="$3">
      <XStack
        flexGrow={1}
        flexBasis={0}
        minWidth={0}
        alignItems="center"
        gap="$3"
      >
        <Token
          size="lg"
          tokenImageUri={getHyperliquidTokenImageUrl(holding.symbol)}
        />
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {holding.symbol}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {holding.balance}
          </SizableText>
        </YStack>
      </XStack>
      <YStack flexShrink={0} alignItems="flex-end" gap="$0.5">
        <SizableText size="$bodyLgMedium" numberOfLines={1} textAlign="right">
          {holding.value}
        </SizableText>
        <SizableText
          size="$bodyMd"
          color={getPnlColor(holding.pnl)}
          numberOfLines={1}
          textAlign="right"
        >
          {holding.pnl ?? '--'}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function PerpsMobileHoldingsSummary() {
  const intl = useIntl();

  return (
    <YStack display="flex" $gtMd={{ display: 'none' }} gap="$3" py="$2">
      <XStack alignItems="center" justifyContent="space-between" gap="$4">
        <XStack flex={1} minWidth={0} alignItems="center" gap="$1">
          <SizableText size="$headingXl" color="$text" numberOfLines={1}>
            {intl.formatMessage({ id: ETranslations.global_perp })}
          </SizableText>
          <SizableText size="$headingXl" color="$textSubdued">
            ·
          </SizableText>
          <SizableText size="$headingXl" color="$textSubdued" numberOfLines={1}>
            {MOCK_PERPS_ACCOUNT_VALUE}
          </SizableText>
        </XStack>
        <PerpsDepositButton testID={HomeTestIDs.perpsDepositButton} />
      </XStack>
      <YStack gap="$0.5">
        <XStack alignItems="center" gap="$3" pt="$1.5">
          <XStack flexGrow={1} flexBasis={0} alignItems="center" gap="$1">
            <SizableText size="$bodyXs" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_name })}
            </SizableText>
            <SizableText size="$bodyXs" color="$textSubdued">
              /
            </SizableText>
            <SizableText size="$bodyXs" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_balance })}
            </SizableText>
          </XStack>
          <XStack
            flexGrow={1}
            flexBasis={0}
            justifyContent="flex-end"
            gap="$1"
            alignItems="center"
          >
            <SizableText size="$bodyXs" color="$textSubdued">
              {`${intl.formatMessage({ id: ETranslations.global_value })} / `}
            </SizableText>
            <DashText size="$bodyXs" color="$textSubdued" dashThickness={0.5}>
              {intl.formatMessage({
                id: ETranslations.perp_position_pnl_mobile,
              })}
            </DashText>
          </XStack>
        </XStack>
        <YStack>
          {MOCK_PERPS_HOLDINGS.map((holding) => (
            <PerpsMobileHoldingRow key={holding.symbol} holding={holding} />
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
}

function PerpsMetric({
  labelId,
  value,
  align = 'left',
  positive,
  negative,
  labelExtra,
  column,
  showRepeat,
  emphasis,
}: {
  labelId: ETranslations;
  value: string;
  align?: 'left' | 'right';
  positive?: boolean;
  negative?: boolean;
  labelExtra?: string;
  column?: 'left' | 'center' | 'right';
  showRepeat?: boolean;
  emphasis?: boolean;
}) {
  const intl = useIntl();
  let alignItems: 'center' | 'flex-end' | 'flex-start' = 'flex-start';
  if (column === 'center') {
    alignItems = 'center';
  } else if (align === 'right') {
    alignItems = 'flex-end';
  }
  let valueColor = '$text';
  if (positive) {
    valueColor = '$green11';
  } else if (negative) {
    valueColor = '$red11';
  }

  return (
    <YStack
      width={column === 'left' || column === 'right' ? 120 : undefined}
      flex={column === 'center' || !column ? 1 : undefined}
      gap="$1"
      alignItems={alignItems}
    >
      <XStack alignItems="center" gap="$1">
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          $gtMd={{ size: '$bodySm' }}
        >
          {intl.formatMessage({ id: labelId })}
          {labelExtra}
        </SizableText>
        {showRepeat ? (
          <Icon name="RepeatOutline" size="$3" color="$textSubdued" />
        ) : null}
      </XStack>
      <SizableText
        size={emphasis ? '$bodyMdMedium' : '$bodySmMedium'}
        color={valueColor}
        $gtMd={{ size: emphasis ? '$bodyLgMedium' : '$bodyMdMedium' }}
      >
        {value}
      </SizableText>
    </YStack>
  );
}

function PerpsPositionCard({ position }: { position: IPerpsMockPosition }) {
  const intl = useIntl();
  const isLong = position.side === 'long';
  const sideColor = isLong ? '$green11' : '$red11';
  const leverageTypeText = intl.formatMessage({
    id:
      position.leverageType === 'cross'
        ? ETranslations.perp_trade_cross
        : ETranslations.perp_trade_isolated,
  });

  return (
    <YStack
      py="$4"
      $gtMd={{
        bg: '$bgSubdued',
        borderRadius: '$3',
        px: '$4',
        py: '$4',
      }}
      gap="$4"
    >
      <XStack justifyContent="space-between" flex={1} position="relative">
        <XStack flex={1} gap="$2" alignItems="center">
          <XStack
            bg={sideColor}
            borderRadius={2}
            w="$4"
            h="$4"
            justifyContent="center"
            alignItems="center"
          >
            <SizableText
              size="$bodySmMedium"
              color="$textOnColor"
              $gtMd={{ size: '$bodyMdMedium' }}
            >
              {intl.formatMessage({
                id: isLong
                  ? ETranslations.perp_position_b
                  : ETranslations.perp_position_s,
              })}
            </SizableText>
          </XStack>
          <SizableText
            size="$bodyMdMedium"
            color="$text"
            $gtMd={{ size: '$headingMd' }}
          >
            {position.coin}
          </SizableText>
          <SizableText
            bg="$bgSubdued"
            borderRadius={2}
            px="$1"
            color="$textSubdued"
            fontSize={10}
            $gtMd={{ size: '$bodySm' }}
          >
            {leverageTypeText} {position.leverage}
          </SizableText>
        </XStack>
        <Icon
          name="ShareOutline"
          size="$3.5"
          color="$iconSubdued"
          $gtMd={{ size: '$4.5' }}
        />
      </XStack>

      <YStack gap="$4">
        <XStack width="100%" justifyContent="space-between" alignItems="center">
          <PerpsMetric
            labelId={ETranslations.perp_position_pnl_mobile}
            value={position.pnl}
            positive
            emphasis
          />
          <PerpsMetric
            labelId={ETranslations.perp_share_roe}
            value={position.roi}
            align="right"
            positive
            emphasis
          />
        </XStack>

        <YStack gap="$4">
          <XStack width="100%" justifyContent="space-between">
            <PerpsMetric
              labelId={ETranslations.perp_position_position_size}
              labelExtra={` (${position.coin})`}
              value={position.size}
              column="left"
              showRepeat
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_margin}
              value={position.margin}
              column="center"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_entry_price}
              value={position.entryPrice}
              align="right"
              column="right"
            />
          </XStack>

          <XStack width="100%" justifyContent="space-between">
            <PerpsMetric
              labelId={ETranslations.perp_position_funding_2}
              value={position.fundingFee}
              negative
              column="left"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_mark_price}
              value={position.markPrice}
              column="center"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_liq_price}
              value={position.liqPrice}
              align="right"
              column="right"
            />
          </XStack>
        </YStack>
      </YStack>

      <Button
        display="flex"
        $gtMd={{ display: 'none' }}
        size="medium"
        variant="secondary"
        childrenAsText={false}
        testID={`${HomeTestIDs.perpsManageButton}-${position.side}`}
      >
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.global_manage })}
        </SizableText>
      </Button>
    </YStack>
  );
}

export function PerpsContainer() {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const [mockViewState, setMockViewState] = useState<IPerpsMockViewState>(
    getMockPerpsViewState,
  );

  return (
    <Tabs.ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight }}>
      <YStack px="$4" py="$3" gap="$2">
        {mockViewState === 'loading' ? <PerpsLoadingState /> : null}
        {mockViewState === 'empty' ? <PerpsEmptyState /> : null}
        {mockViewState === 'ready' ? (
          <>
            <PerpsMobileHoldingsSummary />
            <YStack display="none" $gtMd={{ display: 'flex' }}>
              <RichBlock
                withTitleSeparator
                title={intl.formatMessage({
                  id: ETranslations.perp_account_panel_account_value,
                })}
                subTitle={MOCK_PERPS_ACCOUNT_VALUE}
                headerContainerProps={{ px: 0, pb: 0 }}
                headerActions={<PerpsHeaderActions />}
                content={null}
                plainContentContainer
              />
              <PerpsHoldingsBlock hyperEvmLogoUri={HYPER_EVM_LOGO_URI} />
            </YStack>
            <YStack gap="$3">
              {MOCK_PERPS_POSITIONS.map((position) => (
                <PerpsPositionCard
                  key={`${position.coin}-${position.side}`}
                  position={position}
                />
              ))}
            </YStack>
          </>
        ) : null}
        <PerpsMockStateSwitch
          value={mockViewState}
          onChange={setMockViewState}
        />
      </YStack>
    </Tabs.ScrollView>
  );
}
