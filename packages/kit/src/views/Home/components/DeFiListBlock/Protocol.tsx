import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { type GestureResponderEvent, StyleSheet } from 'react-native';

import {
  Accordion,
  Badge,
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
import { getCategoryConfig } from '@onekeyhq/kit/src/utils/defiCategoryConfig';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IDeFiAsset, IDeFiProtocol } from '@onekeyhq/shared/types/defi';
import { EDeFiAssetType } from '@onekeyhq/shared/types/defi';

import { RichTable } from '../RichTable';

const PROTOCOL_CARD_WEB_SHADOW =
  '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';

function Protocol({
  protocol,
  tableLayout,
  isAllNetworks,
}: {
  protocol: IDeFiProtocol;
  tableLayout?: boolean;
  isAllNetworks?: boolean;
}) {
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
  const getCategoryLabel = useCallback(
    (category: string) => getCategoryConfig(category).label,
    [],
  );

  const renderAssetType = useCallback(
    (asset: IDeFiAsset & { type: EDeFiAssetType }) => {
      let type = asset.category;
      let typeColor = '$blue10';

      if (asset.type === EDeFiAssetType.DEBT) {
        type = 'Borrowed';
        typeColor = '$orange10';
      } else if (asset.type === EDeFiAssetType.REWARD) {
        type = 'Rewards';
        typeColor = '$teal10';
      } else if (asset.type === EDeFiAssetType.ASSET) {
        type = 'Supplied';
        typeColor = '$blue10';
      }

      return (
        <XStack gap="$1" alignItems="center" justifyContent="flex-end">
          <Stack
            width={7}
            height={7}
            borderRadius="$full"
            backgroundColor={typeColor}
          />
          <SizableText size="$bodyMdMedium">{type}</SizableText>
        </XStack>
      );
    },
    [],
  );

  const renderAssetValue = useCallback(
    (value: IDeFiAsset['value']) => {
      const valueBN = new BigNumber(value);
      const isValueUnavailable = valueBN.isNaN() || valueBN.isZero();

      return (
        <XStack alignItems="center" justifyContent="flex-end" gap="$1">
          {isValueUnavailable ? (
            <Stack width="$4" height="$4">
              <Tooltip
                renderContent={intl.formatMessage({
                  id: ETranslations.wallet_price_unavailable,
                })}
                renderTrigger={
                  <Icon name="ErrorOutline" size="$4" color="$iconCritical" />
                }
              />
            </Stack>
          ) : null}
          <NumberSizeableTextWrapper
            hideValue
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
            color={isValueUnavailable ? '$text' : undefined}
          >
            {isValueUnavailable ? '--' : valueBN.toFixed()}
          </NumberSizeableTextWrapper>
        </XStack>
      );
    },
    [intl, settings.currencyInfo.symbol],
  );

  const getColumns = useCallback(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.global_asset }),
        dataIndex: 'symbol',
        render: (symbol: string, record: IDeFiAsset) => (
          <XStack gap="$3" alignItems="center">
            <Token
              size="sm"
              tokenImageUri={record.meta?.logoUrl}
              bg="$bgStrong"
            />
            <SizableText size="$bodyMdMedium">{symbol}</SizableText>
          </XStack>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'category',
        columnProps: {
          pr: '$2',
        },
        render: (
          _category: string,
          record: IDeFiAsset & { type: EDeFiAssetType },
        ) => renderAssetType(record),
      },
      {
        title: 'Amount',
        dataIndex: 'amount',
        render: (amount: string) => (
          <NumberSizeableTextWrapper
            hideValue
            size="$bodyMdMedium"
            formatter="balance"
          >
            {amount}
          </NumberSizeableTextWrapper>
        ),
      },
      {
        title: 'USD value',
        dataIndex: 'value',
        render: (value: IDeFiAsset['value']) => renderAssetValue(value),
      },
    ],
    [intl, renderAssetType, renderAssetValue],
  );

  const handlePressProtocol = useCallback(() => {
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetDetailRoutes.DeFiProtocolDetails,
      params: {
        protocol,
        protocolInfo,
      },
    });
  }, [protocol, protocolInfo, navigation]);

  const handleOpenProtocolUrl = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();

      if (!protocolInfo?.protocolUrl) {
        return;
      }

      if (platformEnv.isDesktop || platformEnv.isNative) {
        openUrlInDiscovery({
          url: protocolInfo.protocolUrl,
        });
      } else {
        openUrlExternal(protocolInfo.protocolUrl);
      }
    },
    [protocolInfo?.protocolUrl],
  );

  const renderProtocolPositions = useCallback(() => {
    const columns = getColumns();

    return protocol.positions.map((position, index) => {
      const positionCategoryConfig = getCategoryConfig(position.category);
      const positionAssets = [
        ...position.assets,
        ...position.debts,
        ...position.rewards,
      ];

      return (
        <YStack key={position.groupId}>
          <YStack py="$2">
            <XStack alignItems="center" gap="$3" pl="$3" pr="$5" py="$3">
              <Badge bg={positionCategoryConfig.bg} badgeSize="sm">
                <Badge.Text color={positionCategoryConfig.text}>
                  {getCategoryLabel(position.category)}
                </Badge.Text>
              </Badge>
              <Popover
                hoverable
                placement="top"
                title={intl.formatMessage({
                  id: ETranslations.wallet_defi_position_name_popover_title,
                })}
                renderTrigger={
                  <SizableText
                    size="$bodyMd"
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
                      {position.poolFullName}
                    </SizableText>
                  </Stack>
                }
              />
              <NumberSizeableTextWrapper
                hideValue
                size="$bodyMdMedium"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
                textAlign="right"
                numberOfLines={1}
                maxWidth="45%"
              >
                {position.value}
              </NumberSizeableTextWrapper>
            </XStack>
            <RichTable<IDeFiAsset & { type: EDeFiAssetType }>
              dataSource={positionAssets}
              columns={columns}
              keyExtractor={(item, assetIndex) =>
                `${position.groupId}-${item.address}-${item.type}-${assetIndex}`
              }
              estimatedItemSize={48}
              onRow={() => ({
                onPress: undefined,
              })}
              rowProps={{
                px: '$5',
                py: '$2',
                minHeight: 48,
                bg: 'transparent',
                borderRadius: '$0',
                hoverStyle: { bg: 'transparent' },
                pressStyle: { bg: 'transparent' },
                cursor: 'default',
              }}
              headerRowProps={{
                px: '$5',
                py: '$2',
                minHeight: 32,
              }}
            />
          </YStack>
          {index !== protocol.positions.length - 1 ? (
            <XStack px="$5" py="$2">
              <Stack
                flex={1}
                height={StyleSheet.hairlineWidth}
                backgroundColor="$borderSubdued"
              />
            </XStack>
          ) : null}
        </YStack>
      );
    });
  }, [
    getCategoryLabel,
    getColumns,
    intl,
    protocol.positions,
    settings.currencyInfo.symbol,
  ]);

  if (!tableLayout) {
    return (
      <ListItem
        key={`${protocol.protocol}-${protocol.networkId}`}
        gap="$3"
        alignItems="center"
        justifyContent="space-between"
        onPress={handlePressProtocol}
      >
        <XStack alignItems="center" gap="$3" flex={1}>
          <Token
            size="lg"
            tokenImageUri={protocolInfo?.protocolLogo}
            showNetworkIcon={isAllNetworks}
            networkId={protocol.networkId}
          />
          <YStack flex={1}>
            <SizableText size="$bodyLgMedium" flex={1}>
              {protocolInfo?.protocolName ?? protocol.protocol}
            </SizableText>
            <XStack alignItems="center" gap="$1" flexWrap="wrap" flex={1}>
              {protocol.categories.slice(0, 2).map((category) => {
                const categoryConfig = getCategoryConfig(category);

                return (
                  <Badge key={category} bg={categoryConfig.bg} badgeSize="sm">
                    <Badge.Text color={categoryConfig.text}>
                      {getCategoryLabel(category)}
                    </Badge.Text>
                  </Badge>
                );
              })}
              {protocol.categories.length > 2 ? (
                <Badge badgeType="default" badgeSize="sm">
                  <Badge.Text>{`+${protocol.categories.length - 2}`}</Badge.Text>
                </Badge>
              ) : null}
            </XStack>
          </YStack>
        </XStack>
        <ListItem.Text
          align="right"
          primary={
            <NumberSizeableTextWrapper
              hideValue
              size="$bodyLgMedium"
              formatter="value"
              formatterOptions={{ currency: settings.currencyInfo.symbol }}
            >
              {protocolInfo?.netWorth ?? '0'}
            </NumberSizeableTextWrapper>
          }
        />
      </ListItem>
    );
  }

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
                  <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
                    <SizableText size="$headingMd" numberOfLines={1}>
                      {protocolInfo?.protocolName ?? protocol.protocol}
                    </SizableText>
                    {protocolInfo?.protocolUrl ? (
                      <XStack
                        onPress={handleOpenProtocolUrl}
                        cursor="pointer"
                        borderRadius="$full"
                        p="$1"
                        hoverStyle={{
                          bg: '$bgHover',
                        }}
                        pressStyle={{
                          bg: '$bgActive',
                        }}
                      >
                        <Icon
                          name="ArrowTopRightOutline"
                          size="$5"
                          color="$iconSubdued"
                        />
                      </XStack>
                    ) : null}
                  </XStack>
                </XStack>
                <NumberSizeableTextWrapper
                  hideValue
                  size="$headingMd"
                  formatter="value"
                  formatterOptions={{
                    currency: settings.currencyInfo.symbol,
                  }}
                  numberOfLines={1}
                  textAlign="right"
                  minWidth={120}
                  maxWidth={168}
                >
                  {protocolInfo?.netWorth ?? '0'}
                </NumberSizeableTextWrapper>
                <View
                  ml="$2"
                  animation="quick"
                  animateOnly={ANIMATE_ONLY_TRANSFORM}
                  rotate={open ? '180deg' : '0deg'}
                  transformOrigin="center"
                >
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    size="$6"
                  />
                </View>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.Content exitStyle={{ opacity: 0 }} px="$0" py="$0">
            {renderProtocolPositions()}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}

export { Protocol };
