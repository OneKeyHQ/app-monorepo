import { useMemo } from 'react';

import { type RouteProp, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Divider,
  Icon,
  IconButton,
  Page,
  Popover,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  type IProtocolPositionSection,
  buildProtocolPositionItems,
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

function ProtocolDetailAssetValue({
  value,
  currencySymbol,
  priceUnavailableLabel,
}: {
  value: number;
  currencySymbol: string;
  priceUnavailableLabel: string;
}) {
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
}

function ProtocolDetailSection({
  section,
  currencySymbol,
  priceUnavailableLabel,
}: {
  section: IProtocolPositionSection;
  currencySymbol: string;
  priceUnavailableLabel: string;
}) {
  return (
    <YStack bg="$bgSubdued" borderRadius="$2" px="$3" py="$2" gap="$1">
      <SizableText size="$headingXs" color="$text" textTransform="uppercase">
        {section.title}
      </SizableText>
      {section.assets.map((asset, assetIndex) => (
        <XStack
          key={`${section.key}-${asset.address}-${assetIndex}`}
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
            <ProtocolDetailAssetValue
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
}

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

  const positionNamePopoverTitle = intl.formatMessage({
    id: ETranslations.wallet_defi_position_name_popover_title,
  });
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });

  const positions = useMemo(
    () =>
      buildProtocolPositionItems(protocol).map((position) => ({
        ...position,
        sections: position.sections.map((section) => ({
          ...section,
          title: section.titleId
            ? intl.formatMessage({ id: section.titleId })
            : section.title,
        })),
      })),
    [intl, protocol],
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
              tokenImageUri={protocolInfo.protocolLogo}
              showNetworkIcon
              networkId={protocol.networkId}
            />
            <YStack flex={1} minWidth={0}>
              <SizableText size="$heading2xl" numberOfLines={1}>
                {protocolInfo.protocolName}
              </SizableText>
              <NumberSizeableTextWrapper
                hideValue
                size="$bodyLgMedium"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
                color="$textSubdued"
              >
                {protocolInfo.netWorth}
              </NumberSizeableTextWrapper>
            </YStack>
          </XStack>
          {protocolInfo.protocolUrl ? (
            <IconButton
              title={intl.formatMessage({
                id: ETranslations.global_view_in_blockchain_explorer,
              })}
              variant="tertiary"
              icon="OpenOutline"
              size="small"
              onPress={() => {
                if (platformEnv.isDesktop || platformEnv.isNative) {
                  openUrlInDiscovery({
                    url: protocolInfo.protocolUrl,
                  });
                } else {
                  openUrlExternal(protocolInfo.protocolUrl);
                }
              }}
            />
          ) : null}
        </XStack>
        <Divider />
        <YStack py="$3">
          {positions.map((position, index) => (
            <Stack key={position.groupId} px="$5">
              <XStack alignItems="center" py="$3" gap="$2">
                <Badge bg={position.categoryConfig.bg} badgeSize="lg">
                  <Badge.Text
                    color={position.categoryConfig.text}
                    textTransform="capitalize"
                  >
                    {position.category}
                  </Badge.Text>
                </Badge>
                {position.poolName ? (
                  <Stack flex={1} minWidth={0}>
                    <Popover
                      placement="top"
                      title={positionNamePopoverTitle}
                      renderTrigger={
                        <SizableText
                          size="$headingSm"
                          color="$textSubdued"
                          numberOfLines={1}
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
                  </Stack>
                ) : (
                  <Stack flex={1} />
                )}
                <Stack maxWidth="70%" flexShrink={0} ml="auto">
                  <NumberSizeableTextWrapper
                    hideValue
                    size="$headingMd"
                    formatter="value"
                    formatterOptions={{
                      currency: settings.currencyInfo.symbol,
                    }}
                    numberOfLines={1}
                    textAlign="right"
                  >
                    {position.value}
                  </NumberSizeableTextWrapper>
                </Stack>
              </XStack>
              <YStack gap="$2">
                {position.sections.map((section) => (
                  <ProtocolDetailSection
                    key={section.key}
                    section={section}
                    currencySymbol={settings.currencyInfo.symbol}
                    priceUnavailableLabel={priceUnavailableLabel}
                  />
                ))}
              </YStack>
              {index !== positions.length - 1 ? (
                <Divider mt="$2" mb="$3" />
              ) : null}
            </Stack>
          ))}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default DeFiProtocolDetails;
