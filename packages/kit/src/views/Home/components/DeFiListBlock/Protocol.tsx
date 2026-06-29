import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Accordion, Stack, YStack } from '@onekeyhq/components';
import type { IProtocolPositionActionSuccessParams } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useDeFiListProtocolMapAtom,
  useDeFiListSupportedActionsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import {
  type IDeFiProtocolDisplayInfo,
  type ILocalizedProtocolCategoryGroup,
  buildLocalizedProtocolCategoryGroups,
  buildProtocolDisplayInfo,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { ProtocolCategoryGroup } from './ProtocolCategoryGroup';
import { ProtocolHeaderRow } from './ProtocolHeaderRow';
import { ProtocolRow } from './ProtocolRow';

type IProtocolProps = {
  accountId?: string;
  indexedAccountId?: string;
  protocol: IDeFiProtocol;
  tableLayout?: boolean;
  isAllNetworks?: boolean;
  onActionSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
};

export type IProtocolHandle = {
  expand: () => void;
  collapse: () => void;
  getAnchor: () => HTMLElement | null;
};

const ProtocolListLayout = memo(
  ({
    protocol,
    protocolInfo,
    isAllNetworks,
    onPressProtocol,
  }: {
    protocol: IDeFiProtocol;
    protocolInfo?: IProtocolSummary;
    isAllNetworks?: boolean;
    onPressProtocol: () => void;
  }) => {
    return (
      <ProtocolRow
        protocol={protocol}
        protocolInfo={protocolInfo}
        isAllNetworks={isAllNetworks}
        onPress={onPressProtocol}
      />
    );
  },
);
ProtocolListLayout.displayName = 'ProtocolListLayout';

const ACCORDION_OPEN_VALUE = 'protocol';

const ProtocolDesktopLayout = memo(
  forwardRef<
    IProtocolHandle,
    {
      protocol: IDeFiProtocol;
      accountId?: string;
      indexedAccountId?: string;
      protocolDisplayInfo: IDeFiProtocolDisplayInfo;
      isAllNetworks?: boolean;
      currencySymbol: string;
      positionCountText: string;
      priceUnavailableLabel: string;
      partialPriceUnavailableLabel: string;
      categoryGroups: ILocalizedProtocolCategoryGroup[];
      supportedActions: IDeFiSupportedProtocolAction[];
      onActionSuccess?: (
        params: IProtocolPositionActionSuccessParams,
      ) => void | Promise<void>;
    }
  >(
    (
      {
        protocol,
        accountId,
        indexedAccountId,
        protocolDisplayInfo,
        isAllNetworks,
        currencySymbol,
        positionCountText,
        priceUnavailableLabel,
        partialPriceUnavailableLabel,
        categoryGroups,
        supportedActions,
        onActionSuccess,
      },
      forwardedRef,
    ) => {
      // Container's pin tracker reads getBoundingClientRect() because the
      // shared Tabs.Container's overflow:hidden ancestor blocks CSS sticky.
      const anchorRef = useRef<HTMLElement | null>(null);
      const [accordionValue, setAccordionValue] =
        useState<string>(ACCORDION_OPEN_VALUE);

      useImperativeHandle(
        forwardedRef,
        () => ({
          expand: () => {
            setAccordionValue(ACCORDION_OPEN_VALUE);
          },
          collapse: () => {
            setAccordionValue('');
          },
          getAnchor: () => anchorRef.current,
        }),
        [],
      );

      return (
        <Stack
          ref={(node) => {
            // Outer card DOM node on web. Tamagui's ref union accepts HTMLElement
            // via the web adapter; cast to capture it for the imperative handle.
            anchorRef.current = node as unknown as HTMLElement | null;
          }}
          borderRadius="$3"
          borderCurve="continuous"
          overflow="hidden"
          // Body and header bg follow the mobile Figma card surface.
          bg="$bgApp"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$border"
          $platform-web={{
            boxShadow: 'none',
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
            value={accordionValue}
            onValueChange={setAccordionValue}
          >
            <Accordion.Item value={ACCORDION_OPEN_VALUE}>
              <Accordion.Trigger
                bg="$transparent"
                borderWidth={0}
                p="$0"
                hoverStyle={{ bg: '$transparent' }}
                pressStyle={{ bg: '$transparent' }}
                focusStyle={{ bg: '$transparent' }}
                cursor="pointer"
              >
                {({ open }: { open: boolean }) => (
                  <ProtocolHeaderRow
                    name={protocolDisplayInfo.protocolName}
                    logo={protocolDisplayInfo.protocolLogo}
                    networkId={protocol.networkId}
                    currencySymbol={currencySymbol}
                    netWorth={protocolDisplayInfo.netWorth}
                    protocolUrl={protocolDisplayInfo.protocolUrl}
                    isAllNetworks={isAllNetworks}
                    positionCountText={positionCountText}
                    open={open}
                  />
                )}
              </Accordion.Trigger>
              <Accordion.Content exitStyle={{ opacity: 0 }} px="$0" py="$0">
                <YStack pb="$3" gap="$3">
                  {categoryGroups.map((group) => (
                    <ProtocolCategoryGroup
                      key={group.groupKey}
                      accountId={protocol.accountId ?? accountId}
                      indexedAccountId={
                        protocol.indexedAccountId ?? indexedAccountId
                      }
                      protocol={protocol}
                      group={group}
                      currencySymbol={currencySymbol}
                      priceUnavailableLabel={priceUnavailableLabel}
                      partialPriceUnavailableLabel={
                        partialPriceUnavailableLabel
                      }
                      supportedActions={supportedActions}
                      onActionSuccess={onActionSuccess}
                    />
                  ))}
                </YStack>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        </Stack>
      );
    },
  ),
);
ProtocolDesktopLayout.displayName = 'ProtocolDesktopLayout';

function useProtocolViewModel({
  protocol,
  accountId,
  indexedAccountId,
}: Pick<IProtocolProps, 'protocol' | 'accountId' | 'indexedAccountId'>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();
  const [{ protocolMap }] = useDeFiListProtocolMapAtom();
  const [{ supportedActions }] = useDeFiListSupportedActionsAtom();

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
  const partialPriceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_partial_price_unavailable,
  });
  const categoryGroups = useMemo<ILocalizedProtocolCategoryGroup[]>(
    () =>
      buildLocalizedProtocolCategoryGroups({
        protocol,
        translate,
      }),
    [protocol, translate],
  );
  // Position count drives the header sub-label and is independent of the
  // category grouping; we still want the raw count of upstream positions, not
  // the merged row count.
  const positionsLength = protocol.positions.length;
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
      `${positionsLength} ${intl.formatMessage({
        id: ETranslations.earn_positions,
      })}`,
    [intl, positionsLength],
  );

  const onPressProtocol = useCallback(() => {
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetDetailRoutes.DeFiProtocolDetails,
      params: {
        protocol,
        protocolInfo,
        accountId,
        indexedAccountId,
      },
    });
  }, [accountId, indexedAccountId, navigation, protocol, protocolInfo]);

  return {
    categoryGroups,
    currencySymbol,
    onPressProtocol,
    positionCountText,
    priceUnavailableLabel,
    partialPriceUnavailableLabel,
    protocolDisplayInfo,
    protocolInfo,
    supportedActions,
  };
}

const Protocol = forwardRef<IProtocolHandle, IProtocolProps>(
  (
    {
      accountId,
      indexedAccountId,
      protocol,
      tableLayout,
      isAllNetworks,
      onActionSuccess,
    }: IProtocolProps,
    forwardedRef,
  ) => {
    const viewModel = useProtocolViewModel({
      protocol,
      accountId,
      indexedAccountId,
    });

    if (!tableLayout) {
      // Small-screen list has no Accordion/anchor to drive. forwardedRef
      // is intentionally dropped; callers should only pass a ref on the
      // desktop branch (DeFiListBlock wires registerProtocol only when
      // tableLayout is true).
      return (
        <ProtocolListLayout
          protocol={protocol}
          protocolInfo={viewModel.protocolInfo}
          isAllNetworks={isAllNetworks}
          onPressProtocol={viewModel.onPressProtocol}
        />
      );
    }

    return (
      <ProtocolDesktopLayout
        ref={forwardedRef}
        accountId={accountId}
        indexedAccountId={indexedAccountId}
        protocol={protocol}
        protocolDisplayInfo={viewModel.protocolDisplayInfo}
        isAllNetworks={isAllNetworks}
        currencySymbol={viewModel.currencySymbol}
        positionCountText={viewModel.positionCountText}
        priceUnavailableLabel={viewModel.priceUnavailableLabel}
        partialPriceUnavailableLabel={viewModel.partialPriceUnavailableLabel}
        categoryGroups={viewModel.categoryGroups}
        supportedActions={viewModel.supportedActions}
        onActionSuccess={onActionSuccess}
      />
    );
  },
);
Protocol.displayName = 'Protocol';

export { Protocol };
