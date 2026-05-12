import { useMemo } from 'react';

import { type RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Badge,
  Divider,
  IconButton,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ProtocolPositionSection } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionSection';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  buildLocalizedProtocolPositionItems,
  buildProtocolDisplayInfo,
  getProtocolPositionDisplayName,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

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

  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });

  const positions = useMemo(
    () =>
      buildLocalizedProtocolPositionItems({
        protocol,
        translate: (id) => intl.formatMessage({ id }),
      }),
    [intl, protocol],
  );
  const protocolDisplayInfo = useMemo(
    () =>
      buildProtocolDisplayInfo({
        protocol,
        protocolInfo,
      }),
    [protocol, protocolInfo],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_portfolio_details })}
      />
      <Page.Body>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          p="$5"
        >
          <XStack alignItems="center" gap="$3" flex={1} minWidth={0}>
            <Token
              size="xl"
              tokenImageUri={protocolDisplayInfo.protocolLogo}
              showNetworkIcon
              networkId={protocol.networkId}
            />
            <YStack flex={1} minWidth={0}>
              <SizableText size="$heading2xl" numberOfLines={1}>
                {protocolDisplayInfo.protocolName}
              </SizableText>
              <NumberSizeableTextWrapper
                hideValue
                size="$bodyLgMedium"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
                color="$textSubdued"
              >
                {protocolDisplayInfo.netWorth}
              </NumberSizeableTextWrapper>
            </YStack>
          </XStack>
          {protocolDisplayInfo.protocolUrl ? (
            <IconButton
              title={intl.formatMessage({
                id: ETranslations.global_view_in_blockchain_explorer,
              })}
              variant="tertiary"
              icon="OpenOutline"
              size="small"
              onPress={() => {
                const targetUrl = protocolDisplayInfo.protocolUrl;
                if (!targetUrl) {
                  return;
                }
                if (platformEnv.isDesktop || platformEnv.isNative) {
                  openUrlInDiscovery({
                    url: targetUrl,
                  });
                } else {
                  openUrlExternal(targetUrl);
                }
              }}
            />
          ) : null}
        </XStack>
        <Divider />
        <YStack py="$3" gap="$5">
          {positions.map((position) => {
            const positionDisplayName =
              getProtocolPositionDisplayName(position);

            return (
              <Stack key={position.positionKey} px="$5">
                <XStack
                  alignItems="center"
                  justifyContent="space-between"
                  minHeight={40}
                  gap="$2"
                >
                  <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
                    <Badge badgeType="success" badgeSize="sm" flexShrink={0}>
                      {position.categoryLabel}
                    </Badge>
                    {positionDisplayName ? (
                      <SizableText
                        size="$bodyMdMedium"
                        color="$text"
                        numberOfLines={1}
                        flex={1}
                        minWidth={0}
                      >
                        {positionDisplayName}
                      </SizableText>
                    ) : null}
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
                    maxWidth="45%"
                  >
                    {position.value}
                  </NumberSizeableTextWrapper>
                </XStack>
                <YStack gap="$2">
                  {position.sections.map((section) => (
                    <ProtocolPositionSection
                      key={section.key}
                      itemKeyPrefix={position.positionKey}
                      section={section}
                      currencySymbol={settings.currencyInfo.symbol}
                      priceUnavailableLabel={priceUnavailableLabel}
                    />
                  ))}
                </YStack>
              </Stack>
            );
          })}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default DeFiProtocolDetails;
