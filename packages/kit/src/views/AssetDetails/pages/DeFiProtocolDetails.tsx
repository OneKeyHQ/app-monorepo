import { useCallback } from 'react';

import { type RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Badge,
  Divider,
  IconButton,
  NumberSizeableText,
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EDeFiAssetType, type IDeFiAsset } from '@onekeyhq/shared/types/defi';

function DeFiProtocolDetails() {
  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.DeFiProtocolDetails
      >
    >();
  const { protocol, protocolInfo } = route.params;
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const renderProtocolOverview = useCallback(() => {
    return (
      <>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          p="$5"
        >
          <XStack alignItems="center" gap="$3">
            <Token
              size="xl"
              tokenImageUri={protocolInfo?.protocolLogo}
              showNetworkIcon
              networkId={protocol.networkId}
            />
            <YStack>
              <SizableText size="$heading2xl" numberOfLines={1}>
                {protocolInfo?.protocolName ?? ''}
              </SizableText>
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
                color="$textSubdued"
              >
                {protocolInfo?.netWorth ?? '0'}
              </NumberSizeableText>
            </YStack>
          </XStack>
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
        <Divider />
      </>
    );
  }, [
    protocolInfo?.netWorth,
    settings.currencyInfo.symbol,
    protocol.networkId,
    intl,
    protocolInfo?.protocolUrl,
    protocolInfo?.protocolLogo,
    protocolInfo?.protocolName,
  ]);

  const renderAssetType = useCallback(
    (asset: IDeFiAsset & { type: EDeFiAssetType }) => {
      let type = asset.category;
      let badgeType = 'info';
      if (asset.type === EDeFiAssetType.DEBT) {
        type = appLocale.intl.formatMessage({
          id: ETranslations.wallet_defi_asset_type_borrowed,
        });
        badgeType = 'warning';
      } else if (asset.type === EDeFiAssetType.REWARD) {
        type = appLocale.intl.formatMessage({
          id: ETranslations.wallet_defi_position_module_rewards,
        });
        badgeType = 'success';
      } else if (asset.type === EDeFiAssetType.ASSET) {
        type = appLocale.intl.formatMessage({
          id: ETranslations.wallet_defi_asset_type_supplied,
        });
        badgeType = 'info';
      }

      return (
        <XStack>
          <Badge badgeType={badgeType} badgeSize="lg">
            <Badge.Text textTransform="capitalize">{type}</Badge.Text>
          </Badge>
        </XStack>
      );
    },
    [],
  );
  const renderProtocolPositions = useCallback(() => {
    return (
      <YStack py="$3">
        {protocol.positions.map((position, index) => (
          <Stack key={position.category} px="$5">
            <XStack
              alignItems="center"
              justifyContent="space-between"
              py="$3"
              ml="$-2"
            >
              <XStack flex={1} alignItems="center" gap="$3">
                <Badge badgeType="success" badgeSize="lg">
                  <Badge.Text textTransform="capitalize">
                    {position.category}
                  </Badge.Text>
                </Badge>
                <Popover
                  placement="top"
                  title={intl.formatMessage({
                    id: ETranslations.wallet_defi_position_name_popover_title,
                  })}
                  renderTrigger={
                    <SizableText
                      size="$bodySm"
                      color="$textSubdued"
                      numberOfLines={1}
                      textDecorationLine="underline"
                      textDecorationColor="$textSubdued"
                      textDecorationStyle="dotted"
                    >
                      {position.poolName}
                    </SizableText>
                  }
                  renderContent={
                    <Stack px="$4" py="$2">
                      <SizableText size="$bodyLg">
                        {position.poolFullName}
                      </SizableText>
                    </Stack>
                  }
                />
              </XStack>
              <NumberSizeableText
                size="$headingMd"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
              >
                {position.value}
              </NumberSizeableText>
            </XStack>
            <YStack>
              {[...position.assets, ...position.debts, ...position.rewards].map(
                (asset) => (
                  <XStack
                    key={asset.address}
                    alignItems="center"
                    gap="$3"
                    justifyContent="space-between"
                    py="$2"
                    flex={1}
                  >
                    <XStack alignItems="center" gap="$3" flex={1}>
                      <Token size="md" tokenImageUri={asset.meta?.logoUrl} />
                      <YStack flex={1}>
                        <SizableText size="$bodyLgMedium">
                          {asset.symbol}
                        </SizableText>
                        {renderAssetType(asset)}
                      </YStack>
                    </XStack>
                    <YStack flex={1} alignItems="flex-end">
                      <NumberSizeableText
                        size="$bodyLgMedium"
                        formatter="balance"
                      >
                        {asset.amount}
                      </NumberSizeableText>
                      <NumberSizeableText
                        size="$bodyMd"
                        formatter="value"
                        formatterOptions={{
                          currency: settings.currencyInfo.symbol,
                        }}
                        color="$textSubdued"
                      >
                        {asset.value}
                      </NumberSizeableText>
                    </YStack>
                  </XStack>
                ),
              )}
            </YStack>
            {index !== protocol.positions.length - 1 ? (
              <Divider mt="$2" mb="$3" />
            ) : null}
          </Stack>
        ))}
      </YStack>
    );
  }, [protocol.positions, intl, settings.currencyInfo.symbol, renderAssetType]);
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_portfolio_details })}
      />
      <Page.Body>
        {renderProtocolOverview()}
        {renderProtocolPositions()}
      </Page.Body>
    </Page>
  );
}

export default DeFiProtocolDetails;
