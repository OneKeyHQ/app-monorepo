import { useCallback, useEffect, useMemo } from 'react';

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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { DEFI_PORTFOLIO_DETAIL_POSITION_NAME_COLOR } from '@onekeyhq/kit/src/components/DeFi/defiPortfolioDetailStyleUtils';
import { DeFiPositionHealthFactorRow } from '@onekeyhq/kit/src/components/DeFi/DeFiPositionHealthFactorRow';
import { preloadProtocolLendingActionDialog } from '@onekeyhq/kit/src/components/DeFi/ProtocolLendingActionDialog';
import {
  type IProtocolPositionProviderDisplayInfo,
  ProtocolPositionActionButton,
} from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionButton';
import type { IProtocolPositionActionSuccessParams } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import { ProtocolPositionSection } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionSection';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { getProtocolPositionSectionsValueState } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  type ILocalizedProtocolPositionItem,
  buildLocalizedProtocolPositionItems,
  buildProtocolDisplayInfo,
  getProtocolPositionDisplayName,
  isSectionedPosition,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IDeFiProtocol } from '@onekeyhq/shared/types/defi';

function buildActionPosition(
  position: ILocalizedProtocolPositionItem,
): IDeFiProtocol['positions'][number] {
  return {
    groupId: position.groupId,
    category: position.category,
    poolName: position.poolName ?? '',
    poolFullName: position.poolFullName ?? position.poolName ?? '',
    value: position.value,
    assets: position.sections
      .filter(
        (section) =>
          section.assetType === 'supplied' || section.assetType === 'other',
      )
      .flatMap((section) => section.assets),
    debts: position.sections
      .filter((section) => section.assetType === 'borrowed')
      .flatMap((section) => section.assets),
    rewards: position.sections
      .filter((section) => section.assetType === 'rewards')
      .flatMap((section) => section.assets),
    sourcePositions: position.sourcePositions,
  };
}

function DeFiProtocolDetails() {
  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.DeFiProtocolDetails
      >
    >();
  const {
    protocol,
    protocolInfo,
    accountId: routeAccountId,
    indexedAccountId: routeIndexedAccountId,
    supportedActions: routeSupportedActions,
  } = route.params;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();
  // The list hands us the resolved actions so the buttons paint with the
  // positions. Only fetch when we arrive without them (e.g. deep link).
  const hasRouteSupportedActions = Boolean(routeSupportedActions?.length);
  const { result: fetchedSupportedActions = [] } =
    usePromiseResult(async () => {
      if (routeSupportedActions && routeSupportedActions.length > 0) {
        return routeSupportedActions;
      }
      try {
        return await backgroundApiProxy.serviceDeFi.fetchSupportedDeFiProtocols();
      } catch (error) {
        defaultLogger.app.error.log(
          `DeFi supported actions fetch failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return [];
      }
    }, [routeSupportedActions]);
  const supportedActions =
    routeSupportedActions && hasRouteSupportedActions
      ? routeSupportedActions
      : fetchedSupportedActions;
  const actionAccountId = protocol.accountId ?? routeAccountId;
  const actionIndexedAccountId =
    protocol.indexedAccountId ?? routeIndexedAccountId;
  const handleActionSuccess = useCallback(
    ({ accountId, networkId }: IProtocolPositionActionSuccessParams) => {
      appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
      void backgroundApiProxy.serviceDeFi
        .refreshAccountDeFiPositionsAfterAction({
          accountId,
          networkId,
        })
        .catch((error) => {
          defaultLogger.app.error.log(
            `DeFi positions refresh after action failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      navigation.pop();
    },
    [navigation],
  );

  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const partialPriceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_partial_price_unavailable,
  });

  const positions = useMemo(
    () =>
      buildLocalizedProtocolPositionItems({
        protocol,
        translate: (id) => intl.formatMessage({ id }),
      }),
    [intl, protocol],
  );
  const shouldPreloadProtocolLendingActionDialog =
    positions.some(isSectionedPosition);
  useEffect(() => {
    if (shouldPreloadProtocolLendingActionDialog) {
      preloadProtocolLendingActionDialog();
    }
  }, [shouldPreloadProtocolLendingActionDialog]);

  const protocolDisplayInfo = useMemo(
    () =>
      buildProtocolDisplayInfo({
        protocol,
        protocolInfo,
      }),
    [protocol, protocolInfo],
  );
  const providerDisplayInfo = useMemo<
    IProtocolPositionProviderDisplayInfo | undefined
  >(() => {
    if (!protocolInfo?.protocolName && !protocolInfo?.protocolLogo) {
      return undefined;
    }
    return {
      providerDisplayName: protocolInfo?.protocolName || undefined,
      providerLogoURI: protocolInfo?.protocolLogo || undefined,
    };
  }, [protocolInfo?.protocolLogo, protocolInfo?.protocolName]);

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
              testID="asset-details-icon-btn"
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
            const positionValueState = getProtocolPositionSectionsValueState(
              position.sections,
            );
            const hasPartialUnavailableValue =
              positionValueState.hasAvailableValue &&
              positionValueState.hasUnavailableValue;
            const actionPosition = buildActionPosition(position);
            // Sectioned (lending / debt-bearing) positions route their block
            // Withdraw/Repay through the lending dialog's asset dropdown; every
            // position now renders the same bottom block-button row.
            const sectioned = isSectionedPosition(position);

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
                        color={DEFI_PORTFOLIO_DETAIL_POSITION_NAME_COLOR}
                        numberOfLines={1}
                        flex={1}
                        minWidth={0}
                      >
                        {positionDisplayName}
                      </SizableText>
                    ) : null}
                  </XStack>
                  <Stack maxWidth="45%" alignItems="flex-end">
                    <ProtocolValueCell
                      value={positionValueState.value}
                      currencySymbol={settings.currencyInfo.symbol}
                      priceUnavailableLabel={priceUnavailableLabel}
                      partialPriceUnavailableLabel={
                        partialPriceUnavailableLabel
                      }
                      isUnavailable={!positionValueState.hasAvailableValue}
                      showPriceUnavailableTooltip={hasPartialUnavailableValue}
                      size="$headingMd"
                      textAlign="right"
                      numberOfLines={1}
                    />
                  </Stack>
                </XStack>
                {typeof position.healthFactor === 'number' ? (
                  <Stack pt="$2" pb="$1">
                    <DeFiPositionHealthFactorRow
                      healthFactor={position.healthFactor}
                    />
                  </Stack>
                ) : null}
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
                  <ProtocolPositionActionButton
                    accountId={actionAccountId}
                    indexedAccountId={actionIndexedAccountId}
                    protocol={protocol}
                    providerDisplayInfo={providerDisplayInfo}
                    position={actionPosition}
                    supportedActions={supportedActions}
                    block
                    preferLendingDialog={sectioned}
                    actionPresentation={
                      platformEnv.isNative ? 'modal-route' : 'dialog'
                    }
                    onSuccess={handleActionSuccess}
                  />
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
