import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Accordion,
  Badge,
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDeFiListProtocolMapAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IDeFiAsset, IDeFiProtocol } from '@onekeyhq/shared/types/defi';
import { EDeFiAssetType } from '@onekeyhq/shared/types/defi';

import { RichTable } from '../RichTable';

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

  const columns = useMemo(() => {
    return [
      {
        title: intl.formatMessage({ id: ETranslations.global_asset }),
        dataIndex: 'symbol',
        render: (symbol: string, record: IDeFiAsset) => (
          <XStack gap="$3" alignItems="center">
            <Token size="lg" tokenImageUri={record.meta?.logoUrl} />
            <SizableText size="$bodyMdMedium">{symbol}</SizableText>
          </XStack>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'category',
        render: (
          category: string,
          record: IDeFiAsset & { type: EDeFiAssetType },
        ) => {
          let type = '';
          if (record.type === EDeFiAssetType.DEBT) {
            type = intl.formatMessage({
              id: ETranslations.wallet_defi_asset_type_borrowed,
            });
          } else if (record.type === EDeFiAssetType.REWARD) {
            type = intl.formatMessage({
              id: ETranslations.wallet_defi_position_module_rewards,
            });
          } else if (record.type === EDeFiAssetType.ASSET) {
            type = intl.formatMessage({
              id: ETranslations.wallet_defi_asset_type_supplied,
            });
          } else {
            type = category;
          }
          return (
            <Badge badgeType="info" badgeSize="lg">
              <Badge.Text textTransform="capitalize">{type}</Badge.Text>
            </Badge>
          );
        },
      },
      {
        title: 'Amount',
        dataIndex: 'amount',
        render: (amount: string) => (
          <NumberSizeableText size="$bodyMdMedium" formatter="balance">
            {amount}
          </NumberSizeableText>
        ),
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_value }),
        dataIndex: 'value',
        render: (value: string) => (
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
          >
            {value}
          </NumberSizeableText>
        ),
      },
    ];
  }, [settings.currencyInfo.symbol, intl]);

  const renderProtocolPositions = useCallback(() => {
    return protocol.positions.map((position, index) => {
      if (index !== 0 && index !== protocol.positions.length - 1) {
        return <Divider key={index} />;
      }

      return (
        <Stack key={position.category}>
          <XStack
            alignItems="center"
            justifyContent="space-between"
            pl="$1"
            pr="$3"
            py="$3"
          >
            <Badge badgeType="success" badgeSize="lg">
              <Badge.Text textTransform="capitalize">
                {position.category}
              </Badge.Text>
            </Badge>
            <NumberSizeableText
              size="$headingSm"
              formatter="value"
              formatterOptions={{ currency: settings.currencyInfo.symbol }}
            >
              {position.value}
            </NumberSizeableText>
          </XStack>
          <RichTable<IDeFiAsset & { type: EDeFiAssetType }>
            dataSource={position.all}
            columns={columns}
            keyExtractor={(item) => item.address}
            estimatedItemSize={48}
            onRow={() => ({
              onPress: undefined,
            })}
          />
        </Stack>
      );
    });
  }, [protocol.positions, settings.currencyInfo.symbol, columns]);

  const handlePressProtocol = useCallback(() => {
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetDetailRoutes.DeFiProtocolDetails,
      params: {
        protocol,
        protocolInfo,
      },
    });
  }, [protocol, protocolInfo, navigation]);

  if (!tableLayout) {
    return (
      <ListItem
        key={`${protocol.protocol}-${protocol.networkId}`}
        gap="$3"
        alignItems="center"
        justifyContent="space-between"
        onPress={handlePressProtocol}
        mx="$-2"
        px="$2"
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
              {protocol.categories.slice(0, 2).map((category) => (
                <Badge key={category} badgeType="success" badgeSize="sm">
                  <Badge.Text textTransform="capitalize">{category}</Badge.Text>
                </Badge>
              ))}
              {protocol.categories.length > 2 ? (
                <Badge badgeType="success" badgeSize="sm">
                  <Badge.Text textTransform="capitalize">
                    {`+${protocol.categories.length - 2}`}
                  </Badge.Text>
                </Badge>
              ) : null}
            </XStack>
          </YStack>
        </XStack>
        <ListItem.Text
          align="right"
          primary={
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="value"
              formatterOptions={{ currency: settings.currencyInfo.symbol }}
            >
              {protocolInfo?.netWorth ?? '0'}
            </NumberSizeableText>
          }
        />
      </ListItem>
    );
  }

  return (
    <Accordion
      key={`${protocol.protocol}-${protocol.networkId}`}
      collapsible
      overflow="hidden"
      width="100%"
      type="single"
      defaultValue="protocol"
      borderRadius="$3"
      borderCurve="continuous"
      $platform-web={{
        boxShadow:
          '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $theme-dark={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $platform-ios={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.2,
        shadowRadius: 0.5,
      }}
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
        >
          {({ open }: { open: boolean }) => (
            <>
              <XStack gap="$3" alignItems="center">
                <Token
                  size="lg"
                  tokenImageUri={protocolInfo?.protocolLogo}
                  isNFT
                  showNetworkIcon={isAllNetworks}
                  networkId={protocol.networkId}
                />
                <SizableText size="$headingLg">
                  {protocolInfo?.protocolName ?? protocol.protocol}
                </SizableText>
                <IconButton
                  title={intl.formatMessage({
                    id: ETranslations.global_view_in_blockchain_explorer,
                  })}
                  variant="tertiary"
                  icon="OpenOutline"
                  size="small"
                  onPress={() => openUrlExternal(protocolInfo?.protocolUrl)}
                />
              </XStack>
              <XStack alignItems="center" gap="$3">
                <NumberSizeableText
                  size="$headingLg"
                  formatter="value"
                  formatterOptions={{ currency: settings.currencyInfo.symbol }}
                >
                  {protocolInfo?.netWorth ?? '0'}
                </NumberSizeableText>
                <View
                  animation="quick"
                  rotate={open ? '180deg' : '0deg'}
                  transformOrigin="center"
                >
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    size="$6"
                  />
                </View>
              </XStack>
            </>
          )}
        </Accordion.Trigger>
        <Accordion.Content exitStyle={{ opacity: 0 }} py="$2">
          {renderProtocolPositions()}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

export { Protocol };
