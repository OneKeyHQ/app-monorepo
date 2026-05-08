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

import {
  Accordion,
  Badge,
  Divider,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ProtocolPositionSection } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionSection';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
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
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { ProtocolHeaderRow } from './ProtocolHeaderRow';
import { ProtocolRow } from './ProtocolRow';

type IProtocolProps = {
  protocol: IDeFiProtocol;
  tableLayout?: boolean;
  isAllNetworks?: boolean;
};

export type IProtocolHandle = {
  expand: () => void;
  collapse: () => void;
  getAnchor: () => HTMLElement | null;
  setCompactProgress: (progress: number) => void;
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
      protocolDisplayInfo: IDeFiProtocolDisplayInfo;
      isAllNetworks?: boolean;
      currencySymbol: string;
      positionCountText: string;
      positionNamePopoverTitle: string;
      priceUnavailableLabel: string;
      positions: ILocalizedProtocolPositionItem[];
    }
  >(
    (
      {
        protocol,
        protocolDisplayInfo,
        isAllNetworks,
        currencySymbol,
        positionCountText,
        positionNamePopoverTitle,
        priceUnavailableLabel,
        positions,
      },
      forwardedRef,
    ) => {
      // Container's pin tracker reads getBoundingClientRect() because the
      // shared Tabs.Container's overflow:hidden ancestor blocks CSS sticky.
      const anchorRef = useRef<HTMLElement | null>(null);
      const [accordionValue, setAccordionValue] =
        useState<string>(ACCORDION_OPEN_VALUE);
      const [compactProgress, setCompactProgress] = useState(0);

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
          setCompactProgress: (progress: number) => {
            setCompactProgress((prev) =>
              Math.abs(prev - progress) < 0.01 ? prev : progress,
            );
          },
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
                    isAllNetworks={isAllNetworks}
                    positionCountText={positionCountText}
                    open={open}
                    compactProgress={compactProgress}
                  />
                )}
              </Accordion.Trigger>
              <Accordion.Content exitStyle={{ opacity: 0 }} px="$0" py="$0">
                <YStack pt="$2">
                  {positions.map((position, index) => {
                    const isLastPosition = index === positions.length - 1;
                    return (
                      <YStack
                        key={position.positionKey}
                        pb={isLastPosition ? '$3' : '$0'}
                      >
                        <XStack
                          alignItems="center"
                          gap="$2"
                          px="$5"
                          minHeight={40}
                        >
                          <Badge bg={position.categoryConfig.bg} badgeSize="lg">
                            <Badge.Text color={position.categoryConfig.text}>
                              {position.categoryLabel}
                            </Badge.Text>
                          </Badge>
                          {position.poolName ? (
                            <Stack flex={1} minWidth={0}>
                              <Popover
                                hoverable
                                placement="top"
                                title={positionNamePopoverTitle}
                                renderTrigger={
                                  <SizableText
                                    size="$headingSm"
                                    color="$textSubdued"
                                    numberOfLines={1}
                                    minWidth={0}
                                  >
                                    {position.poolName}
                                  </SizableText>
                                }
                                renderContent={
                                  <Stack px="$4" py="$2">
                                    <SizableText size="$bodyLgMedium">
                                      {position.poolFullName ||
                                        position.poolName}
                                    </SizableText>
                                  </Stack>
                                }
                              />
                            </Stack>
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
                        {index !== positions.length - 1 ? (
                          <Stack px="$5" pt="$3" pb="$2">
                            <Divider />
                          </Stack>
                        ) : null}
                      </YStack>
                    );
                  })}
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
    protocolInfo,
  };
}

const Protocol = forwardRef<IProtocolHandle, IProtocolProps>(
  ({ protocol, tableLayout, isAllNetworks }: IProtocolProps, forwardedRef) => {
    const viewModel = useProtocolViewModel({ protocol });

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
  },
);
Protocol.displayName = 'Protocol';

export { Protocol };
