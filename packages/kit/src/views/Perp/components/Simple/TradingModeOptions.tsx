import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  ButtonFrame,
  Carousel,
  Dialog,
  SizableText,
  XStack,
  YStack,
  getSharedButtonStyles,
} from '@onekeyhq/components';
import type { ICarouselInstance } from '@onekeyhq/components';
import { useTradingLoadingAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { PerpActionButton } from '../PerpActionButton';

import { TradingModeIllustration } from './TradingModeIllustration';

const TRADING_MODES = ['simple', 'pro'] as const;
const PREVIEW_MODES = [...TRADING_MODES];
const PREVIEW_PAGE_PADDING = 20;

export function TradingModeOptions({
  onSelect,
}: {
  onSelect: (mode: 'simple' | 'pro') => void;
}) {
  const intl = useIntl();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [settings] = usePerpsCustomSettingsAtom();
  const [selectedMode, setSelectedMode] = useState<'simple' | 'pro'>(
    settings.mobileTradingMode ?? 'pro',
  );
  const [submitting] = useTradingLoadingAtom();
  const disabled = submitting;
  const carouselRef = useRef<ICarouselInstance | null>(null);
  const initialPage = useRef(TRADING_MODES.indexOf(selectedMode));
  const [previewWidth, setPreviewWidth] = useState(Math.min(400, windowWidth));
  const [headlineHeight, setHeadlineHeight] = useState(28);
  const illustrationSize = Math.min(
    360,
    windowHeight * 0.42,
    previewWidth - PREVIEW_PAGE_PADDING * 2,
  );
  const handlePageChanged = useCallback(
    (index: number) => {
      const mode = TRADING_MODES[index];
      if (!disabled && mode) setSelectedMode(mode);
    },
    [disabled],
  );
  return (
    <YStack gap="$4">
      <Dialog.Header>
        <XStack
          width={200}
          maxWidth="100%"
          alignSelf="flex-start"
          p="$0.5"
          gap="$0.5"
          bg="$bgStrong"
          borderRadius="$full"
          accessibilityRole="radiogroup"
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.perp_simple_mode__title,
          })}
        >
          {TRADING_MODES.map((mode, index) => {
            const selected = selectedMode === mode;
            const { sharedFrameStyles, color } = getSharedButtonStyles({
              variant: selected ? 'accent' : 'tertiary',
              disabled,
            });
            const label = intl.formatMessage({
              id:
                mode === 'simple'
                  ? ETranslations.perp_simple_easy__title
                  : ETranslations.dexmarket_pro,
            });
            return (
              <ButtonFrame
                key={mode}
                {...sharedFrameStyles}
                flex={1}
                px="$2.5"
                py="$1"
                minHeight={28}
                mx="$0"
                my="$0"
                borderRadius="$full"
                disabled={disabled}
                testID={`perps-mode-dialog-${mode}`}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected, disabled }}
                onPress={(event) => {
                  event.stopPropagation();
                  if (disabled) return;
                  setSelectedMode(mode);
                  carouselRef.current?.scrollTo({ index });
                  defaultLogger.ui.button.click({
                    trackId: `perps-mode-dialog-${mode}`,
                  });
                }}
              >
                <SizableText size="$bodyMdMedium" color={color}>
                  {label}
                </SizableText>
              </ButtonFrame>
            );
          })}
        </XStack>
      </Dialog.Header>
      <YStack
        testID="perps-mode-preview-carousel"
        width="100%"
        overflow="hidden"
        pointerEvents={disabled ? 'none' : 'auto'}
        onLayout={({ nativeEvent }) => {
          if (nativeEvent.layout.width > 0) {
            setPreviewWidth(nativeEvent.layout.width);
          }
        }}
      >
        <Carousel
          ref={carouselRef}
          data={PREVIEW_MODES}
          defaultIndex={initialPage.current}
          pageWidth={previewWidth}
          containerStyle={{ height: illustrationSize + 16 + headlineHeight }}
          loop={false}
          autoPlayEnabled={false}
          showPagination={false}
          disableAnimation
          pagerProps={{ scrollEnabled: !disabled }}
          onPageChanged={handlePageChanged}
          renderItem={({ item: mode }) => (
            <YStack
              width={previewWidth}
              px={PREVIEW_PAGE_PADDING}
              gap="$4"
              accessibilityElementsHidden={mode !== selectedMode}
              importantForAccessibility={
                mode === selectedMode ? 'auto' : 'no-hide-descendants'
              }
            >
              <YStack
                width={illustrationSize}
                height={illustrationSize}
                alignSelf="center"
                p="$8"
                bg="$bgStrong"
                borderRadius="$6"
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <YStack
                  testID={`perps-mode-preview-${mode}`}
                  flex={1}
                  borderRadius="$5"
                >
                  <TradingModeIllustration mode={mode} />
                </YStack>
              </YStack>
              <YStack
                onLayout={({ nativeEvent }) => {
                  setHeadlineHeight((height) =>
                    Math.max(height, nativeEvent.layout.height),
                  );
                }}
              >
                <SizableText size="$headingLg" accessibilityRole="header">
                  {intl.formatMessage({
                    id:
                      mode === 'simple'
                        ? ETranslations.perp_simple_easy_headline__title
                        : ETranslations.perp_simple_pro_headline__title,
                  })}
                </SizableText>
              </YStack>
            </YStack>
          )}
        />
      </YStack>
      <PerpActionButton
        testID="perps-mode-dialog-confirm"
        mx="$5"
        size="large"
        variant="accent"
        disabled={disabled}
        onPress={() => {
          if (!disabled) onSelect(selectedMode);
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_confirm })}
      </PerpActionButton>
    </YStack>
  );
}
