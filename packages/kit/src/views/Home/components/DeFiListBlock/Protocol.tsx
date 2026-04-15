import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Accordion,
  Badge,
  Divider,
  Icon,
  Popover,
  SizableText,
  Stack,
  Tooltip,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDeFiListProtocolMapAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import {
  type IProtocolPositionItem,
  type IProtocolPositionSection,
  buildProtocolPositionItems,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiAsset,
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

const PROTOCOL_CARD_WEB_SHADOW =
  '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';

type IProtocolProps = {
  protocol: IDeFiProtocol;
  tableLayout?: boolean;
  isAllNetworks?: boolean;
};

const ProtocolAssetValue = memo(
  ({
    value,
    currencySymbol,
    priceUnavailableLabel,
  }: {
    value: IDeFiAsset['value'];
    currencySymbol: string;
    priceUnavailableLabel: string;
  }) => {
    const valueBN = new BigNumber(value);
    const isValueUnavailable = valueBN.isNaN() || valueBN.isZero();

    return (
      <XStack alignItems="center" justifyContent="flex-end" gap="$1">
        {isValueUnavailable ? (
          <Stack width="$4" height="$4">
            <Tooltip
              renderContent={priceUnavailableLabel}
              renderTrigger={
                <Icon name="ErrorOutline" size="$4" color="$iconCritical" />
              }
            />
          </Stack>
        ) : null}
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyLg"
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
          color={isValueUnavailable ? '$text' : undefined}
        >
          {isValueUnavailable ? '--' : valueBN.toFixed()}
        </NumberSizeableTextWrapper>
      </XStack>
    );
  },
);
ProtocolAssetValue.displayName = 'ProtocolAssetValue';

const ProtocolPositionSection = memo(
  ({
    groupId,
    section,
    currencySymbol,
    priceUnavailableLabel,
  }: {
    groupId: string;
    section: IProtocolPositionSection;
    currencySymbol: string;
    priceUnavailableLabel: string;
  }) => {
    return (
      <YStack bg="$bgSubdued" borderRadius="$2" px="$3" py="$2" gap="$1">
        <SizableText size="$headingXs" color="$text">
          {section.title}
        </SizableText>
        {section.assets.map((asset, assetIndex) => (
          <XStack
            key={`${groupId}-${section.key}-${asset.address}-${assetIndex}`}
            alignItems="center"
            justifyContent="space-between"
            gap="$3"
            py="$1"
          >
            <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
              <Token
                size="sm"
                tokenImageUri={asset.meta?.logoUrl}
                bg="$bgStrong"
              />
              <SizableText size="$headingSm" numberOfLines={1}>
                {asset.symbol}
              </SizableText>
            </XStack>
            <YStack alignItems="flex-end" maxWidth="55%">
              <ProtocolAssetValue
                value={asset.value}
                currencySymbol={currencySymbol}
                priceUnavailableLabel={priceUnavailableLabel}
              />
              <NumberSizeableTextWrapper
                hideValue
                size="$bodyMd"
                color="$textSubdued"
                formatter="balance"
                textAlign="right"
              >
                {asset.amount}
              </NumberSizeableTextWrapper>
            </YStack>
          </XStack>
        ))}
      </YStack>
    );
  },
);
ProtocolPositionSection.displayName = 'ProtocolPositionSection';

const ProtocolListLayout = memo(
  ({
    protocol,
    protocolInfo,
    currencySymbol,
    onPressProtocol,
  }: {
    protocol: IDeFiProtocol;
    protocolInfo?: IProtocolSummary;
    currencySymbol: string;
    onPressProtocol: () => void;
  }) => {
    return (
      <ListItem
        key={`${protocol.protocol}-${protocol.networkId}`}
        gap="$3"
        alignItems="center"
        justifyContent="space-between"
        onPress={onPressProtocol}
        drillIn
      >
        <Token size="lg" tokenImageUri={protocolInfo?.protocolLogo} isNFT />
        <SizableText size="$bodyLgMedium" numberOfLines={1} flex={1}>
          {protocolInfo?.protocolName ?? protocol.protocol}
        </SizableText>
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyLgMedium"
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
          textAlign="right"
          flexShrink={0}
          maxWidth={120}
        >
          {protocolInfo?.netWorth ?? 0}
        </NumberSizeableTextWrapper>
      </ListItem>
    );
  },
);
ProtocolListLayout.displayName = 'ProtocolListLayout';

const ProtocolDesktopLayout = memo(
  ({
    protocol,
    protocolInfo,
    isAllNetworks,
    currencySymbol,
    positionCountText,
    positionNamePopoverTitle,
    priceUnavailableLabel,
    positions,
  }: {
    protocol: IDeFiProtocol;
    protocolInfo?: IProtocolSummary;
    isAllNetworks?: boolean;
    currencySymbol: string;
    positionCountText: string;
    positionNamePopoverTitle: string;
    priceUnavailableLabel: string;
    positions: IProtocolPositionItem[];
  }) => {
    return (
      <Stack
        borderRadius="$3"
        borderCurve="continuous"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        overflow="hidden"
        bg="$bgApp"
        $platform-web={{
          boxShadow: PROTOCOL_CARD_WEB_SHADOW,
        }}
        $platform-ios={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 0.5 },
          shadowOpacity: 0.2,
          shadowRadius: 0.5,
        }}
        $theme-dark={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '$borderSubdued',
        }}
      >
        <Accordion
          key={`${protocol.protocol}-${protocol.networkId}`}
          collapsible
          overflow="hidden"
          width="100%"
          type="single"
          defaultValue="protocol"
        >
          <Accordion.Item value="protocol">
            <Accordion.Trigger
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              px="$5"
              py="$3"
              bg="$bgSubdued"
              borderWidth={0}
              hoverStyle={{ bg: '$bgSubdued' }}
              pressStyle={{ bg: '$bgSubdued' }}
              focusStyle={{ bg: '$bgSubdued' }}
              cursor="pointer"
            >
              {({ open }: { open: boolean }) => (
                <>
                  <XStack gap="$3" alignItems="center" flex={1} minWidth={0}>
                    <Token
                      size="md"
                      tokenImageUri={protocolInfo?.protocolLogo}
                      isNFT
                      showNetworkIcon={isAllNetworks}
                      networkId={protocol.networkId}
                    />
                    <YStack flex={1} minWidth={0} alignItems="flex-start">
                      <SizableText size="$headingLg" numberOfLines={1}>
                        {protocolInfo?.protocolName ?? protocol.protocol}
                      </SizableText>
                      <SizableText
                        size="$headingSm"
                        numberOfLines={1}
                        color="$textSubdued"
                      >
                        {positionCountText}
                      </SizableText>
                    </YStack>
                  </XStack>
                  <NumberSizeableTextWrapper
                    hideValue
                    size="$headingLg"
                    formatter="value"
                    formatterOptions={{ currency: currencySymbol }}
                    numberOfLines={1}
                    textAlign="right"
                    minWidth={120}
                    maxWidth={168}
                  >
                    {protocolInfo?.netWorth ?? 0}
                  </NumberSizeableTextWrapper>
                  <View
                    ml="$3"
                    animation="quick"
                    animateOnly={ANIMATE_ONLY_TRANSFORM}
                    rotate={open ? '180deg' : '0deg'}
                    transformOrigin="center"
                  >
                    <Icon
                      name="ChevronDownSmallSolid"
                      color="$iconSubdued"
                      size="$6"
                    />
                  </View>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.Content exitStyle={{ opacity: 0 }} px="$0" py="$0">
              <YStack
                borderTopWidth={StyleSheet.hairlineWidth}
                borderColor="$borderSubdued"
              >
                {positions.map((position, index) => (
                  <YStack key={position.groupId} py="$3">
                    <XStack alignItems="center" gap="$2" px="$5" minHeight={40}>
                      <Badge bg={position.categoryConfig.bg} badgeSize="lg">
                        <Badge.Text color={position.categoryConfig.text}>
                          {position.categoryLabel}
                        </Badge.Text>
                      </Badge>
                      {position.poolName ? (
                        <Popover
                          hoverable
                          placement="top"
                          title={positionNamePopoverTitle}
                          renderTrigger={
                            <SizableText
                              size="$headingSm"
                              color="$textSubdued"
                              numberOfLines={1}
                              flex={1}
                              minWidth={0}
                            >
                              {position.poolName}
                            </SizableText>
                          }
                          renderContent={
                            <Stack px="$4" py="$2">
                              <SizableText size="$bodyLgMedium">
                                {position.poolFullName || position.poolName}
                              </SizableText>
                            </Stack>
                          }
                        />
                      ) : (
                        <Stack flex={1} />
                      )}
                      <NumberSizeableTextWrapper
                        hideValue
                        size="$headingMd"
                        formatter="value"
                        formatterOptions={{ currency: currencySymbol }}
                        textAlign="right"
                        numberOfLines={1}
                        maxWidth="45%"
                      >
                        {position.value}
                      </NumberSizeableTextWrapper>
                    </XStack>
                    <YStack gap="$2" px="$5">
                      {position.sections.map((section) => (
                        <ProtocolPositionSection
                          key={section.key}
                          groupId={position.groupId}
                          section={section}
                          currencySymbol={currencySymbol}
                          priceUnavailableLabel={priceUnavailableLabel}
                        />
                      ))}
                    </YStack>
                    {index !== positions.length - 1 ? (
                      <Stack px="$5" pt="$3" pb="$1">
                        <Divider />
                      </Stack>
                    ) : null}
                  </YStack>
                ))}
              </YStack>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </Stack>
    );
  },
);
ProtocolDesktopLayout.displayName = 'ProtocolDesktopLayout';

function useProtocolViewModel({ protocol }: Pick<IProtocolProps, 'protocol'>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();
  const [{ protocolMap }] = useDeFiListProtocolMapAtom();

  const protocolInfo: IProtocolSummary | undefined =
    protocolMap[
      defiUtils.buildProtocolMapKey({
        protocol: protocol.protocol,
        networkId: protocol.networkId,
      })
    ];

  const currencySymbol = settings.currencyInfo.symbol;
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const positionNamePopoverTitle = intl.formatMessage({
    id: ETranslations.wallet_defi_position_name_popover_title,
  });
  const positionCount = useMemo(
    () => new Set(protocol.positions.map((position) => position.groupId)).size,
    [protocol.positions],
  );
  const positionCountText = useMemo(
    () =>
      `${positionCount} ${intl.formatMessage({
        id: ETranslations.earn_positions,
      })}`,
    [intl, positionCount],
  );

  const positions = useMemo<IProtocolPositionItem[]>(
    () => buildProtocolPositionItems(protocol),
    [protocol],
  );

  const onPressProtocol = useCallback(() => {
    if (!protocolInfo) {
      return;
    }

    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetDetailRoutes.DeFiProtocolDetails,
      params: {
        protocol,
        protocolInfo,
      },
    });
  }, [navigation, protocol, protocolInfo]);

  return {
    currencySymbol,
    onPressProtocol,
    positionCountText,
    positionNamePopoverTitle,
    positions,
    priceUnavailableLabel,
    protocolInfo,
  };
}

function Protocol({ protocol, tableLayout, isAllNetworks }: IProtocolProps) {
  const viewModel = useProtocolViewModel({ protocol });

  if (!tableLayout) {
    return (
      <ProtocolListLayout
        protocol={protocol}
        protocolInfo={viewModel.protocolInfo}
        currencySymbol={viewModel.currencySymbol}
        onPressProtocol={viewModel.onPressProtocol}
      />
    );
  }

  return (
    <ProtocolDesktopLayout
      protocol={protocol}
      protocolInfo={viewModel.protocolInfo}
      isAllNetworks={isAllNetworks}
      currencySymbol={viewModel.currencySymbol}
      positionCountText={viewModel.positionCountText}
      positionNamePopoverTitle={viewModel.positionNamePopoverTitle}
      priceUnavailableLabel={viewModel.priceUnavailableLabel}
      positions={viewModel.positions}
    />
  );
}

export { Protocol };
