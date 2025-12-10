import { useCallback } from 'react';

import { type RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Badge,
  Divider,
  IconButton,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

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
              tokenImageUri={protocolInfo.protocolLogo}
              showNetworkIcon
              networkId={protocol.networkId}
            />
            <YStack>
              <SizableText size="$heading2xl" numberOfLines={1}>
                {protocolInfo.protocolName}
              </SizableText>
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
                color="$textSubdued"
              >
                {protocolInfo.totalValue}
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
    protocolInfo.totalValue,
    settings.currencyInfo.symbol,
    protocol.networkId,
    intl,
    protocolInfo?.protocolUrl,
    protocolInfo.protocolLogo,
    protocolInfo.protocolName,
  ]);
  const renderProtocolPositions = useCallback(() => {
    return (
      <YStack py="$3">
        {protocol.positions.map((position, index) => (
          <Stack key={position.category} py="$2" px="$5">
            <XStack
              alignItems="center"
              justifyContent="space-between"
              py="$3"
              ml="$-2"
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
            <YStack>
              {position.all.map((asset) => (
                <XStack
                  key={asset.address}
                  alignItems="center"
                  gap="$3"
                  justifyContent="space-between"
                  py="$2"
                >
                  <XStack alignItems="center" gap="$3" flex={1}>
                    <Token size="md" tokenImageUri={asset.meta?.logoUrl} />
                    <YStack>
                      <SizableText size="$bodyLgMedium">
                        {asset.symbol}
                      </SizableText>
                      <SizableText size="$bodyMd" color="$textInfo">
                        {asset.category}
                      </SizableText>
                    </YStack>
                  </XStack>
                  <YStack flex={1} alignItems="flex-end">
                    <SizableText size="$bodyLgMedium">
                      {asset.amount}
                    </SizableText>
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
              ))}
            </YStack>
            {index !== 0 && index !== protocol.positions.length - 1 ? (
              <Divider my="$3" />
            ) : null}
          </Stack>
        ))}
      </YStack>
    );
  }, [protocol.positions, settings.currencyInfo.symbol]);
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
