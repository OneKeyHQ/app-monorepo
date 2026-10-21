import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  ESwitchSize,
  Icon,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import {
  type IPerpsChartPosition,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { PerpTestIDs } from '../testIDs';
import { getTradingButtonStyleValues } from '../utils/styleUtils';

import { PerpFeatureDot } from './PerpFeatureDot';

const CHART_POSITION_OPTIONS: IPerpsChartPosition[] = [
  'top',
  'bottom',
  'hidden',
];

const MINI_CANDLES = [
  { bodyHeight: 8.5, height: 11.5, id: 'a', offsetY: 3, side: 'long' },
  { bodyHeight: 4, height: 6, id: 'b', offsetY: 6, side: 'short' },
  { bodyHeight: 6.5, height: 9, id: 'c', offsetY: 2, side: 'long' },
  { bodyHeight: 5.5, height: 7.5, id: 'd', offsetY: -1, side: 'long' },
  { bodyHeight: 7.5, height: 10.5, id: 'e', offsetY: 1, side: 'short' },
  { bodyHeight: 9, height: 13, id: 'f', offsetY: 5, side: 'short' },
  { bodyHeight: 2.5, height: 4.5, id: 'g', offsetY: 8, side: 'long' },
  { bodyHeight: 8, height: 10.5, id: 'h', offsetY: 4, side: 'long' },
  { bodyHeight: 3.5, height: 5.5, id: 'i', offsetY: 6, side: 'short' },
  { bodyHeight: 7, height: 10.5, id: 'j', offsetY: 3, side: 'long' },
  { bodyHeight: 2, height: 4, id: 'k', offsetY: 1, side: 'long' },
  { bodyHeight: 6, height: 8.5, id: 'l', offsetY: 0, side: 'long' },
  { bodyHeight: 5, height: 7, id: 'm', offsetY: 3, side: 'short' },
  { bodyHeight: 4.5, height: 7, id: 'n', offsetY: 1, side: 'long' },
  { bodyHeight: 3, height: 7.5, id: 'o', offsetY: -1, side: 'long' },
] as const;

function useLayoutSettingsCopy() {
  const intl = useIntl();

  return useMemo(
    () => ({
      pageTitle: intl.formatMessage({
        id: ETranslations.perps_layout_settings__title,
      }),
      sectionTitle: intl.formatMessage({
        id: ETranslations.perps_trading_page_chart__title,
      }),
      optionLabels: {
        top: intl.formatMessage({ id: ETranslations.global_top }),
        bottom: intl.formatMessage({ id: ETranslations.global_bottom }),
        hidden: intl.formatMessage({
          id: ETranslations.perps_chart_do_not_show__action,
        }),
      } satisfies Record<IPerpsChartPosition, string>,
    }),
    [intl],
  );
}

function MiniCandlestickChart() {
  const longStyles = getTradingButtonStyleValues('long');
  const shortStyles = getTradingButtonStyleValues('short');

  return (
    <XStack
      height={28}
      borderRadius="$1"
      backgroundColor="$bgSubdued"
      alignItems="center"
      justifyContent="space-between"
      px="$1"
    >
      {MINI_CANDLES.map((candle) => {
        const color = candle.side === 'long' ? longStyles.bg : shortStyles.bg;
        const wickHeight = candle.height - candle.bodyHeight;
        const upperWickHeight = Math.max(1, wickHeight * 0.45);
        const lowerWickHeight = Math.max(1, wickHeight - upperWickHeight);
        return (
          <YStack
            key={candle.id}
            width={4}
            height={candle.height}
            y={candle.offsetY}
            alignItems="center"
            justifyContent="center"
          >
            <Stack width={1} height={upperWickHeight} backgroundColor={color} />
            <Stack
              width={4}
              height={candle.bodyHeight}
              borderRadius={1}
              backgroundColor={color}
            />
            <Stack width={1} height={lowerWickHeight} backgroundColor={color} />
          </YStack>
        );
      })}
    </XStack>
  );
}

function TradingPanelPreview({ compact = false }: { compact?: boolean }) {
  const longStyles = getTradingButtonStyleValues('long');
  const shortStyles = getTradingButtonStyleValues('short');

  return (
    <XStack flex={1} minHeight={0} gap="$2">
      <Stack
        flex={compact ? 1.2 : 1}
        borderRadius="$1"
        backgroundColor="$bgSubdued"
      />
      <YStack flex={1} minWidth={0} gap="$1.5">
        <Stack flex={1} borderRadius="$1" backgroundColor="$bgSubdued" />
        <Stack height={8} borderRadius="$1" backgroundColor={longStyles.bg} />
        <Stack height={8} borderRadius="$1" backgroundColor={shortStyles.bg} />
      </YStack>
    </XStack>
  );
}

function ChartPositionPreview({ position }: { position: IPerpsChartPosition }) {
  return (
    <YStack width="100%" height={104} gap="$2">
      {position === 'top' ? <MiniCandlestickChart /> : null}
      <TradingPanelPreview compact={position === 'hidden'} />
      {position === 'bottom' ? <MiniCandlestickChart /> : null}
    </YStack>
  );
}

function ChartPositionOption({
  label,
  position,
  selected,
  onSelect,
}: {
  label: string;
  onSelect: (position: IPerpsChartPosition) => void;
  position: IPerpsChartPosition;
  selected: boolean;
}) {
  const handlePress = useCallback(() => {
    onSelect(position);
  }, [onSelect, position]);

  return (
    <YStack
      flexGrow={1}
      flexShrink={1}
      flexBasis={0}
      minWidth={0}
      gap="$2"
      alignItems="stretch"
    >
      <YStack
        testID={PerpTestIDs.MobileChartPositionOption(position)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        height={128}
        px="$2"
        py="$1.5"
        justifyContent="center"
        borderRadius="$3"
        borderWidth="$px"
        borderColor={selected ? '$borderActive' : '$borderSubdued'}
        backgroundColor="$bgApp"
        cursor="default"
        onPress={handlePress}
      >
        <ChartPositionPreview position={position} />
      </YStack>
      <SizableText
        size="$bodySmMedium"
        color="$text"
        textAlign="center"
        numberOfLines={1}
        cursor="default"
        onPress={handlePress}
      >
        {label}
      </SizableText>
    </YStack>
  );
}

export function PerpLayoutSettingsEntry({
  onPress,
  showFeatureDot = false,
}: {
  onPress: () => void;
  showFeatureDot?: boolean;
}) {
  const copy = useLayoutSettingsCopy();
  const {
    isFirstVisit: isLayoutSettingsFeatureFirstVisit,
    tourVisited: markLayoutSettingsFeatureVisited,
  } = useSpotlight(ESpotlightTour.perpLayoutSettings);
  const handlePress = useCallback(() => {
    if (showFeatureDot && isLayoutSettingsFeatureFirstVisit) {
      void markLayoutSettingsFeatureVisited();
    }
    onPress();
  }, [
    isLayoutSettingsFeatureFirstVisit,
    markLayoutSettingsFeatureVisited,
    onPress,
    showFeatureDot,
  ]);

  return (
    <XStack
      testID={PerpTestIDs.MobileLayoutSettingsButton}
      minHeight={52}
      mx="$0"
      px="$3"
      gap="$2"
      alignItems="center"
      borderRadius="$3"
      cursor="pointer"
      onPress={handlePress}
      hoverStyle={{ backgroundColor: '$bgHover' }}
      pressStyle={{ backgroundColor: '$bgActive' }}
    >
      <SizableText flex={1} size="$bodyMdMedium" color="$text">
        {copy.pageTitle}
      </SizableText>
      {showFeatureDot && isLayoutSettingsFeatureFirstVisit ? (
        <PerpFeatureDot testID={PerpTestIDs.MobileLayoutSettingsFeatureDot} />
      ) : null}
      <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}

export function PerpPositionActionsSettingsContent() {
  const intl = useIntl();
  const [settings, setSettings] = usePerpsCustomSettingsAtom();
  const actions = [
    { key: 'add', label: ETranslations.add_position__action },
    { key: 'tpsl', label: ETranslations.perp_position_tp_sl_short },
    { key: 'close', label: ETranslations.perp_position_close_short },
    { key: 'reverse', label: 'Reverse' },
  ] as const;
  return (
    <YStack gap="$5" testID={PerpTestIDs.PositionActionsSettingsDialog}>
      <SizableText size="$bodyMd" color="$textSubdued">
        Choose which buttons to show. Disabled buttons are hidden. Changes are
        saved automatically.
      </SizableText>
      {actions.map(({ key, label }) => (
        <XStack
          key={key}
          gap="$4"
          justifyContent="space-between"
          alignItems="center"
        >
          <SizableText size="$bodyLgMedium" flexShrink={1}>
            {key === 'reverse' ? 'Reverse' : intl.formatMessage({ id: label })}
          </SizableText>
          <Switch
            testID={PerpTestIDs.PositionActionSwitch(key)}
            size={ESwitchSize.large}
            value={settings.positionActionVisibility?.[key] !== false}
            onChange={(value) =>
              setSettings((previous) => ({
                ...previous,
                positionActionVisibility: {
                  ...previous.positionActionVisibility,
                  [key]: value,
                },
              }))
            }
          />
        </XStack>
      ))}
    </YStack>
  );
}

export function PerpLayoutSettingsContent({
  onOpenPositionActions,
}: { onOpenPositionActions?: () => void } = {}) {
  const copy = useLayoutSettingsCopy();
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const selectedPosition = perpsCustomSettings.chartPosition ?? 'bottom';

  const handleSelect = useCallback(
    (chartPosition: IPerpsChartPosition) => {
      setPerpsCustomSettings((prev) => ({
        ...prev,
        chartPosition,
      }));
    },
    [setPerpsCustomSettings],
  );

  return (
    <YStack testID={PerpTestIDs.MobileLayoutSettingsPage} width="100%">
      <XStack
        px="$5"
        py="$4"
        gap="$3"
        alignItems="center"
        onPress={onOpenPositionActions}
        cursor="pointer"
        testID={PerpTestIDs.PositionActionsSettingsButton}
      >
        <SizableText size="$bodyLgMedium" flex={1}>
          Position action buttons
        </SizableText>
        <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
      </XStack>
      <YStack px="$5" pt="$2" pb="$6" gap="$3">
        <SizableText size="$bodyLgMedium" color="$text">
          {copy.sectionTitle}
        </SizableText>
        <XStack
          testID={PerpTestIDs.MobileChartPositionControl}
          accessibilityRole="radiogroup"
          width="100%"
          gap="$3.5"
          overflow="hidden"
        >
          {CHART_POSITION_OPTIONS.map((position) => (
            <ChartPositionOption
              key={position}
              position={position}
              label={copy.optionLabels[position]}
              selected={selectedPosition === position}
              onSelect={handleSelect}
            />
          ))}
        </XStack>
      </YStack>
    </YStack>
  );
}

export function showPerpLayoutSettingsDialog({ title }: { title: string }) {
  const dialog = Dialog.show({
    title,
    showFooter: false,
    contentContainerProps: {
      p: '$0',
    },
    floatingPanelProps: {
      overflow: 'hidden',
    },
    renderContent: (
      <PerpsProviderMirror>
        <PerpLayoutSettingsContent
          onOpenPositionActions={() => {
            void Promise.resolve(dialog.close()).then(() => {
              Dialog.show({
                title: 'Position action buttons',
                showFooter: false,
                renderContent: (
                  <PerpsProviderMirror>
                    <PerpPositionActionsSettingsContent />
                  </PerpsProviderMirror>
                ),
              });
            });
          }}
        />
      </PerpsProviderMirror>
    ),
  });
  return dialog;
}
