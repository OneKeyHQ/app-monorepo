import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  DashText,
  Empty,
  Icon,
  Image,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  XStack,
  YStack,
  rootNavigationRef,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useShowDepositWithdrawModal } from '@onekeyhq/kit/src/views/Perp/hooks/useShowDepositWithdrawModal';
import {
  spotActiveAssetAtom,
  tradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IPerpsHomeHolding,
  IPerpsHomePosition,
} from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import {
  getHyperliquidTokenImageUrl,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  OVERVIEW_TILE_SHADOW,
  buildOverviewGridStyle,
} from '../components/DeFiListBlock/DeFiOverviewLayout';
import { resolveOverviewCols } from '../components/DeFiListBlock/overviewColsResolver';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { RichBlock } from '../components/RichBlock';
import { HomeTestIDs } from '../testIDs';

import { usePerpsHomePortfolio } from './usePerpsHomePortfolio';

const HYPER_EVM_LOGO_URI =
  'https://uni.onekey-asset.com/static/chain/hyper-evm.png';
const SPAN_1: React.CSSProperties = { gridColumnEnd: 'span 1' };
const noop = () => undefined;
type TPerpsTradeMode = 'perp' | 'spot';

function isTradableSpotHolding(holding: IPerpsHomeHolding) {
  return Boolean(
    holding.symbol.toUpperCase() !== 'USDC' && holding.spotUniverseName,
  );
}

function useEnsureHomePerpsAccount() {
  const {
    activeAccount: { account, indexedAccount, wallet },
  } = useActiveAccount({ num: 0 });

  return useCallback(async () => {
    if (!account?.id && !indexedAccount?.id) {
      return undefined;
    }
    const deriveType =
      await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: PERPS_NETWORK_ID,
      });
    return backgroundApiProxy.serviceHyperliquid.changeActivePerpsAccount({
      indexedAccountId: indexedAccount?.id ?? null,
      accountId: account?.id ?? null,
      walletId: wallet?.id ?? null,
      deriveType: deriveType ?? 'default',
    });
  }, [account?.id, indexedAccount?.id, wallet?.id]);
}

// Jump into the Perps tab (optionally focusing a coin), mirroring UniversalSearchPerpItem.
function useOpenPerpAsset() {
  const navigation = useAppNavigation();
  const ensureHomePerpsAccount = useEnsureHomePerpsAccount();
  return useCallback(
    (coin?: string, mode: TPerpsTradeMode = 'perp', openMarket = true) => {
      void (async () => {
        const activePerpsAccount = await ensureHomePerpsAccount();
        if (!activePerpsAccount) {
          return;
        }
        if (coin && !activePerpsAccount?.accountAddress) {
          return;
        }
        try {
          if (coin && mode === 'perp') {
            await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
              coin,
            });
            await tradingModeAtom.set('perp');
          } else if (coin && mode === 'spot') {
            await spotActiveAssetAtom.set({
              coin,
              assetId: undefined,
              universe: undefined,
            });
            await tradingModeAtom.set('spot');
          }
        } catch {
          return;
        }
        navigation.switchTab(ETabRoutes.Perp);
        if (!coin) {
          return;
        }
        try {
          appEventBus.emit(EAppEventBusNames.PerpSwitchActiveInstrument, {
            mode,
            coin,
          });
        } catch {
          return;
        }
        if (platformEnv.isNative && openMarket) {
          // The Home navigator can't push into the Perp tab's stack, so go via the root.
          setTimeout(() => {
            rootNavigationRef.current?.navigate(ERootRoutes.Main, {
              screen: ETabRoutes.Perp,
              params: { screen: EModalPerpRoutes.MobilePerpMarket },
            });
          }, 500);
        }
      })();
    },
    [ensureHomePerpsAccount, navigation],
  );
}

function PerpsUsd({
  value,
  ...rest
}: { value: number | undefined } & Omit<ISizableTextProps, 'children'>) {
  if (value === undefined) {
    return <SizableText {...rest}>--</SizableText>;
  }
  return (
    <NumberSizeableText
      formatter="value"
      formatterOptions={{ currency: '$' }}
      {...rest}
    >
      {value}
    </NumberSizeableText>
  );
}

function PerpsTotalUsd({
  value,
  isDegraded,
  ...rest
}: {
  value: number | undefined;
  isDegraded?: boolean;
} & Omit<ISizableTextProps, 'children'>) {
  if (!isDegraded) {
    return <PerpsUsd value={value} {...rest} />;
  }
  return (
    <XStack minWidth={0} alignItems="baseline" gap="$0.5">
      <SizableText size={rest.size} color={rest.color ?? '$textSubdued'}>
        ≈
      </SizableText>
      <PerpsUsd value={value} {...rest} />
    </XStack>
  );
}

// formatValue collapses every negative to "< $0.01", so format the magnitude and
// carry the sign via a currency prefix + color (mirrors PositionsRow's pnl).
function PerpsSignedUsd({
  value,
  ...rest
}: { value: number | undefined } & Omit<
  ISizableTextProps,
  'children' | 'color'
>) {
  if (value === undefined) {
    return (
      <SizableText color="$textSubdued" {...rest}>
        --
      </SizableText>
    );
  }
  const negative = value < 0;
  return (
    <NumberSizeableText
      formatter="value"
      formatterOptions={{ currency: negative ? '-$' : '+$' }}
      color={negative ? '$red11' : '$green11'}
      {...rest}
    >
      {new BigNumber(value).abs().toFixed()}
    </NumberSizeableText>
  );
}

function PerpsHoldingCard({
  holding,
  hyperEvmLogoUri,
  onPress,
}: {
  holding: IPerpsHomeHolding;
  hyperEvmLogoUri: string;
  onPress?: () => void;
}) {
  const isPressable = Boolean(onPress);
  return (
    <XStack
      flex={1}
      bg="$bgSubdued"
      borderRadius="$3"
      px="$3"
      py="$2.5"
      alignItems="center"
      gap="$2.5"
      cursor={isPressable ? 'pointer' : 'default'}
      focusable={isPressable}
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
      }}
      hoverStyle={isPressable ? { bg: '$bgHover' } : undefined}
      pressStyle={isPressable ? { bg: '$bgActive' } : undefined}
      $platform-web={{ boxShadow: OVERVIEW_TILE_SHADOW }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      onPress={onPress ?? noop}
      role={isPressable ? 'button' : undefined}
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
          {holding.displaySymbol}
        </SizableText>
        <PerpsUsd
          value={holding.valueUsd}
          size="$bodyLgMedium"
          color="$text"
          numberOfLines={1}
        />
      </YStack>
    </XStack>
  );
}

function PerpsHoldingsBlock({
  holdings,
  hyperEvmLogoUri,
}: {
  holdings: IPerpsHomeHolding[];
  hyperEvmLogoUri: string;
}) {
  const media = useMedia();
  const openPerp = useOpenPerpAsset();
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
      {holdings.map((holding) => (
        <XStack key={holding.symbol} minWidth={0} style={SPAN_1}>
          <PerpsHoldingCard
            holding={holding}
            hyperEvmLogoUri={hyperEvmLogoUri}
            onPress={
              isTradableSpotHolding(holding)
                ? () => openPerp(holding.spotUniverseName, 'spot')
                : undefined
            }
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

function PerpsPositionsEmptyContent() {
  const intl = useIntl();

  return (
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
  );
}

function PerpsEmptyState({ canDeposit }: { canDeposit: boolean }) {
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
          <PerpsDepositButton
            testID={HomeTestIDs.perpsDepositButton}
            canDeposit={canDeposit}
          />
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
          headerActions={<PerpsHeaderActions canDeposit={canDeposit} />}
          content={null}
          plainContentContainer
        />
      </YStack>
      <PerpsPositionsEmptyContent />
    </>
  );
}

function PerpsDepositButton({
  testID,
  canDeposit,
}: {
  testID: string;
  canDeposit: boolean;
}) {
  const intl = useIntl();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();
  const ensureHomePerpsAccount = useEnsureHomePerpsAccount();

  const handleDeposit = useCallback(async () => {
    if (!canDeposit) {
      return;
    }
    const activePerpsAccount = await ensureHomePerpsAccount();
    if (!activePerpsAccount?.accountId || !activePerpsAccount.accountAddress) {
      return;
    }
    await showDepositWithdrawModal('deposit');
  }, [canDeposit, ensureHomePerpsAccount, showDepositWithdrawModal]);

  if (!canDeposit) {
    return null;
  }

  return (
    <Badge
      testID={testID}
      onPress={() => void handleDeposit()}
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

function PerpsHeaderActions({ canDeposit }: { canDeposit: boolean }) {
  const intl = useIntl();
  const openPerp = useOpenPerpAsset();

  if (!canDeposit) {
    return null;
  }

  return (
    <XStack alignItems="center" gap="$2">
      <PerpsDepositButton
        testID={HomeTestIDs.perpsDesktopDepositButton}
        canDeposit={canDeposit}
      />
      <Button
        size="medium"
        variant="secondary"
        childrenAsText={false}
        testID={HomeTestIDs.perpsManageButton}
        onPress={() => openPerp()}
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

function PerpsMobileHoldingRow({
  holding,
  hyperEvmLogoUri,
  onPress,
}: {
  holding: IPerpsHomeHolding;
  hyperEvmLogoUri: string;
  onPress?: () => void;
}) {
  const isPressable = Boolean(onPress);
  return (
    <XStack
      py="$2"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      cursor={isPressable ? 'pointer' : 'default'}
      pressStyle={isPressable ? { bg: '$bgActive' } : undefined}
      onPress={onPress ?? noop}
      role={isPressable ? 'button' : undefined}
    >
      <XStack
        flexGrow={1}
        flexBasis={0}
        minWidth={0}
        alignItems="center"
        gap="$3"
      >
        <Stack
          width={44}
          height={44}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
        >
          <Stack
            width={40}
            height={40}
            borderRadius="$full"
            bg="$bgApp"
            alignItems="center"
            justifyContent="center"
            position="relative"
          >
            <Token
              size="lg"
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
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {holding.displaySymbol}
          </SizableText>
          <NumberSizeableText
            formatter="balance"
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
          >
            {holding.balance}
          </NumberSizeableText>
        </YStack>
      </XStack>
      <YStack flexShrink={0} alignItems="flex-end" gap="$0.5">
        <PerpsUsd
          value={holding.valueUsd}
          size="$bodyLgMedium"
          numberOfLines={1}
          textAlign="right"
        />
        <PerpsSignedUsd
          value={holding.pnlUsd}
          size="$bodyMd"
          numberOfLines={1}
          textAlign="right"
        />
      </YStack>
    </XStack>
  );
}

function PerpsMobileHoldingsSummary({
  totalUsd,
  holdings,
  isDegraded,
  canDeposit,
}: {
  totalUsd: number;
  holdings: IPerpsHomeHolding[];
  isDegraded?: boolean;
  canDeposit: boolean;
}) {
  const intl = useIntl();
  const openPerp = useOpenPerpAsset();

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
          <PerpsTotalUsd
            value={totalUsd}
            isDegraded={isDegraded}
            size="$headingXl"
            color="$textSubdued"
            numberOfLines={1}
          />
        </XStack>
        <PerpsDepositButton
          testID={HomeTestIDs.perpsDepositButton}
          canDeposit={canDeposit}
        />
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
          {holdings.map((holding) => (
            <PerpsMobileHoldingRow
              key={holding.symbol}
              holding={holding}
              hyperEvmLogoUri={HYPER_EVM_LOGO_URI}
              onPress={
                isTradableSpotHolding(holding)
                  ? () => openPerp(holding.spotUniverseName, 'spot')
                  : undefined
              }
            />
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
}

function PerpsMetric({
  labelId,
  value,
  formatter,
  formatterOptions,
  align = 'left',
  positive,
  negative,
  labelExtra,
  column,
  emphasis,
}: {
  labelId: ETranslations;
  value: string | number;
  formatter?: INumberFormatProps['formatter'];
  formatterOptions?: INumberFormatProps['formatterOptions'];
  align?: 'left' | 'right';
  positive?: boolean;
  negative?: boolean;
  labelExtra?: string;
  column?: 'left' | 'center' | 'right';
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
  const valueSize = emphasis ? '$bodyMdMedium' : '$bodySmMedium';
  const valueGtMdSize = emphasis ? '$bodyLgMedium' : '$bodyMdMedium';

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
      </XStack>
      {formatter ? (
        <NumberSizeableText
          size={valueSize}
          color={valueColor}
          $gtMd={{ size: valueGtMdSize }}
          formatter={formatter}
          formatterOptions={formatterOptions}
          contentStyle={{ color: valueColor }}
          decimalTextStyle={{ color: valueColor }}
          subTextStyle={{ color: valueColor }}
        >
          {value}
        </NumberSizeableText>
      ) : (
        <SizableText
          size={valueSize}
          color={valueColor}
          $gtMd={{ size: valueGtMdSize }}
        >
          {value}
        </SizableText>
      )}
    </YStack>
  );
}

function PerpsPositionCard({ position }: { position: IPerpsHomePosition }) {
  const intl = useIntl();
  const openPerp = useOpenPerpAsset();
  const isLong = position.side === 'long';
  const sideColor = isLong ? '$green11' : '$red11';
  const leverageTypeText = intl.formatMessage({
    id:
      position.leverageType === 'cross'
        ? ETranslations.perp_trade_cross
        : ETranslations.perp_trade_isolated,
  });
  // priceChange formatter is fixed at 2 decimals; PositionsRow shows ROE at 1.
  const roiPercent = new BigNumber(position.roi).times(100).abs().toFixed(1);
  const displayCoin = parseDexCoin(position.coin).displayName;
  const positionSizeUsd = new BigNumber(position.sizeCoin)
    .times(position.markPx)
    .abs()
    .toFixed();

  return (
    <YStack
      py="$3"
      $gtMd={{
        bg: '$bgSubdued',
        borderRadius: '$3',
        px: '$4',
        py: '$4',
      }}
      gap="$3"
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
            size="$headingSm"
            color="$text"
            $gtMd={{ size: '$headingMd' }}
          >
            {displayCoin}
          </SizableText>
          <SizableText
            bg="$bgSubdued"
            borderRadius={2}
            px="$1"
            color="$textSubdued"
            fontSize={10}
            $gtMd={{ size: '$bodySm' }}
          >
            {leverageTypeText} {position.leverageValue}x
          </SizableText>
        </XStack>
      </XStack>

      <YStack gap="$3">
        <XStack width="100%" justifyContent="space-between" alignItems="center">
          <PerpsMetric
            labelId={ETranslations.perp_position_pnl_mobile}
            value={new BigNumber(position.pnlUsd).abs().toFixed()}
            formatter="value"
            formatterOptions={{ currency: position.pnlUsd < 0 ? '-$' : '+$' }}
            positive={position.pnlUsd >= 0}
            negative={position.pnlUsd < 0}
            emphasis
          />
          <PerpsMetric
            labelId={ETranslations.perp_share_roe}
            value={`${position.roi < 0 ? '-' : '+'}${roiPercent}%`}
            align="right"
            positive={position.roi >= 0}
            negative={position.roi < 0}
            emphasis
          />
        </XStack>

        <YStack gap="$3">
          <XStack width="100%" justifyContent="space-between">
            <PerpsMetric
              labelId={ETranslations.perp_position_position_size}
              labelExtra=" (USDC)"
              value={positionSizeUsd}
              formatter="value"
              formatterOptions={{ currency: '$' }}
              column="left"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_margin}
              value={position.marginUsd}
              formatter="value"
              formatterOptions={{ currency: '$' }}
              column="center"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_entry_price}
              value={position.entryPx}
              formatter="price"
              formatterOptions={{ currency: '$' }}
              align="right"
              column="right"
            />
          </XStack>

          <XStack width="100%" justifyContent="space-between">
            {/* fundingUsd > 0 = paid -> red '-$' (mirrors PositionsRow) */}
            <PerpsMetric
              labelId={ETranslations.perp_position_funding_2}
              value={new BigNumber(position.fundingUsd).abs().toFixed()}
              formatter="value"
              formatterOptions={{
                currency: position.fundingUsd > 0 ? '-$' : '+$',
              }}
              positive={position.fundingUsd <= 0}
              negative={position.fundingUsd > 0}
              column="left"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_mark_price}
              value={position.markPx}
              formatter="price"
              formatterOptions={{ currency: '$' }}
              column="center"
            />
            <PerpsMetric
              labelId={ETranslations.perp_position_liq_price}
              value={position.liqPx ?? '--'}
              formatter={position.liqPx ? 'price' : undefined}
              formatterOptions={position.liqPx ? { currency: '$' } : undefined}
              align="right"
              column="right"
            />
          </XStack>
        </YStack>
      </YStack>
      <Button
        testID={HomeTestIDs.perpsManageButton}
        size="small"
        display="flex"
        $gtMd={{ display: 'none' }}
        onPress={() => openPerp(position.coin, 'perp', false)}
      >
        {intl.formatMessage({ id: ETranslations.global_manage })}
      </Button>
    </YStack>
  );
}

export function PerpsContainer() {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const { viewState, view, canDeposit } = usePerpsHomePortfolio();

  return (
    <Stack flex={1}>
      <Tabs.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight }}
        nestedScrollEnabled={platformEnv.isNativeAndroid}
        refreshControl={
          !platformEnv.isNativeAndroid ? (
            <PullToRefresh onRefresh={onHomePageRefresh} />
          ) : undefined
        }
      >
        <YStack px="$5" py="$3" gap="$2" $gtMd={{ px: '$4' }}>
          {viewState === 'loading' ? <PerpsLoadingState /> : null}
          {viewState === 'empty' ? (
            <PerpsEmptyState canDeposit={canDeposit} />
          ) : null}
          {viewState === 'ready' && view ? (
            <>
              <PerpsMobileHoldingsSummary
                totalUsd={view.accountValueUsd}
                holdings={view.holdings}
                isDegraded={view.isDegraded}
                canDeposit={canDeposit}
              />
              <YStack display="none" $gtMd={{ display: 'flex' }}>
                <RichBlock
                  withTitleSeparator
                  title={intl.formatMessage({
                    id: ETranslations.perp_account_panel_account_value,
                  })}
                  subTitle={
                    <PerpsTotalUsd
                      value={view.accountValueUsd}
                      isDegraded={view.isDegraded}
                      size="$headingXl"
                      color="$textSubdued"
                    />
                  }
                  headerContainerProps={{ px: 0, pb: 0 }}
                  headerActions={<PerpsHeaderActions canDeposit={canDeposit} />}
                  content={null}
                  plainContentContainer
                />
                <PerpsHoldingsBlock
                  holdings={view.holdings}
                  hyperEvmLogoUri={HYPER_EVM_LOGO_URI}
                />
              </YStack>
              <YStack gap="$2">
                {view.positions.length > 0 ? (
                  view.positions.map((position) => (
                    <PerpsPositionCard
                      key={`${position.coin}-${position.side}`}
                      position={position}
                    />
                  ))
                ) : (
                  <PerpsPositionsEmptyContent />
                )}
              </YStack>
            </>
          ) : null}
        </YStack>
      </Tabs.ScrollView>
    </Stack>
  );
}
