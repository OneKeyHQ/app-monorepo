import { memo, useCallback, useMemo } from 'react';

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
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { ProtocolPositionActionShell } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionShell';
import { ProtocolPositionSection } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionSection';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDeFiListProtocolMapAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import {
  type IDeFiProtocolDisplayInfo,
  type ILocalizedProtocolPositionItem,
  buildLocalizedProtocolPositionItems,
  buildProtocolDisplayInfo,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type { IDeFiProtocol } from '@onekeyhq/shared/types/defi';

const PROTOCOL_CARD_WEB_SHADOW =
  '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';

type IProtocolProps = {
  protocol: IDeFiProtocol;
  tableLayout?: boolean;
  isAllNetworks?: boolean;
};

const ProtocolListLayout = memo(
  ({
    protocol,
    protocolDisplayInfo,
    isAllNetworks,
    currencySymbol,
    onPressProtocol,
  }: {
    protocol: IDeFiProtocol;
    protocolDisplayInfo: IDeFiProtocolDisplayInfo;
    isAllNetworks?: boolean;
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
        <Token
          size="md"
          tokenImageUri={protocolDisplayInfo.protocolLogo}
          showNetworkIcon={isAllNetworks}
          networkId={protocol.networkId}
        />
        <SizableText size="$bodyLgMedium" numberOfLines={1} flex={1}>
          {protocolDisplayInfo.protocolName}
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
          {protocolDisplayInfo.netWorth}
        </NumberSizeableTextWrapper>
      </ListItem>
    );
  },
);
ProtocolListLayout.displayName = 'ProtocolListLayout';

const ProtocolDesktopLayout = memo(
  ({
    protocol,
    protocolDisplayInfo,
    isAllNetworks,
    currencySymbol,
    positionCountText,
    positionNamePopoverTitle,
    priceUnavailableLabel,
    positions,
  }: {
    protocol: IDeFiProtocol;
    protocolDisplayInfo: IDeFiProtocolDisplayInfo;
    isAllNetworks?: boolean;
    currencySymbol: string;
    positionCountText: string;
    positionNamePopoverTitle: string;
    priceUnavailableLabel: string;
    positions: ILocalizedProtocolPositionItem[];
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
                      tokenImageUri={protocolDisplayInfo.protocolLogo}
                      showNetworkIcon={isAllNetworks}
                      networkId={protocol.networkId}
                    />
                    <YStack flex={1} minWidth={0} alignItems="flex-start">
                      <SizableText size="$headingLg" numberOfLines={1}>
                        {protocolDisplayInfo.protocolName}
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
                    {protocolDisplayInfo.netWorth}
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
                  <YStack key={position.positionKey} py="$3">
                    <XStack alignItems="center" gap="$2" px="$5" minHeight={40}>
                      <Badge bg={position.categoryConfig.bg} badgeSize="lg">
                        <Badge.Text
                          color={position.categoryConfig.text}
                          textTransform="capitalize"
                        >
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
                          itemKeyPrefix={position.positionKey}
                          section={section}
                          currencySymbol={currencySymbol}
                          priceUnavailableLabel={priceUnavailableLabel}
                        />
                      ))}
                    </YStack>
                    {position.action ? (
                      <Stack px="$5" pt="$2">
                        <ProtocolPositionActionShell action={position.action} />
                      </Stack>
                    ) : null}
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

  const protocolInfo =
    protocolMap[
      defiUtils.buildProtocolMapKey({
        protocol: protocol.protocol,
        networkId: protocol.networkId,
      })
    ];

  const currencySymbol = settings.currencyInfo.symbol;
  const translate = useCallback(
    (id: ETranslations) => intl.formatMessage({ id }),
    [intl],
  );
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const positionNamePopoverTitle = intl.formatMessage({
    id: ETranslations.wallet_defi_position_name_popover_title,
  });
  const positions = useMemo<ILocalizedProtocolPositionItem[]>(
    () =>
      buildLocalizedProtocolPositionItems({
        protocol,
        translate,
      }),
    [protocol, translate],
  );
  const protocolDisplayInfo = useMemo(
    () =>
      buildProtocolDisplayInfo({
        protocol,
        protocolInfo,
      }),
    [protocol, protocolInfo],
  );
  const positionCountText = useMemo(
    () =>
      `${positions.length} ${intl.formatMessage({
        id: ETranslations.earn_positions,
      })}`,
    [intl, positions.length],
  );

  const onPressProtocol = useCallback(() => {
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
    protocolDisplayInfo,
  };
}

function Protocol({ protocol, tableLayout, isAllNetworks }: IProtocolProps) {
  const viewModel = useProtocolViewModel({ protocol });

  if (!tableLayout) {
    return (
      <ProtocolListLayout
        protocol={protocol}
        protocolDisplayInfo={viewModel.protocolDisplayInfo}
        isAllNetworks={isAllNetworks}
        currencySymbol={viewModel.currencySymbol}
        onPressProtocol={viewModel.onPressProtocol}
      />
    );
  }

  return (
    <ProtocolDesktopLayout
      protocol={protocol}
      protocolDisplayInfo={viewModel.protocolDisplayInfo}
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
