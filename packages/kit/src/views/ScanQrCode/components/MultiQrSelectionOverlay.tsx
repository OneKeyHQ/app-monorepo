import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { overlayStore } from '@onekeyfe/react-native-native-overlay';
import { useIntl } from 'react-intl';
import { Image, Platform, Pressable } from 'react-native';

import {
  Button,
  Haptics,
  Icon,
  ImpactFeedbackStyle,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  classifyMultiQrLabel,
  mapImagePointToContainView,
  resolveRepelledAnchorPositions,
} from '../utils/multiQrSymbols';

import type {
  IDimensions2D,
  IMultiQrSymbol,
  IPoint2D,
} from '../utils/multiQrSymbols';
import type {
  GestureResponderEvent,
  ImageStyle,
  LayoutChangeEvent,
  ViewStyle,
} from 'react-native';

const DOT_SIZE = 36;
const DOT_BRAND_GREEN = '#00B812';
const DOT_HIT_SLOP = 8;

export type IMultiQrSelectionOverlayProps = {
  symbols: readonly IMultiQrSymbol[];
  onSelect: (symbol: IMultiQrSymbol) => void;
  onCancel: () => void;
  onRefocus?: (point?: IPoint2D) => void;
  /** Optional picked album image URI rendered behind the overlay in `contain` mode. */
  imageUri?: string;
  /** Natural EXIF-oriented dimensions of `imageUri` for `contain` coordinate mapping. */
  imageSize?: IDimensions2D;
};

const rootStyle: ViewStyle = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 20,
};

const stillImageStyle: ImageStyle = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: '#000000',
};

const backdropStyle: ViewStyle = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.48)',
};

const dotWrapStyle: ViewStyle = {
  position: 'absolute',
  width: DOT_SIZE,
  height: DOT_SIZE,
  alignItems: 'center',
  justifyContent: 'center',
};

const dotCoreStyle: ViewStyle = {
  width: DOT_SIZE,
  height: DOT_SIZE,
  borderRadius: DOT_SIZE / 2,
  backgroundColor: DOT_BRAND_GREEN,
  borderWidth: 2,
  borderColor: '#FFFFFF',
  alignItems: 'center',
  justifyContent: 'center',
  elevation: 6,
};

const dotCoreHoveredStyle: ViewStyle = {
  transform: [{ scale: 1.14 }],
};

const dotCorePressedStyle: ViewStyle = {
  transform: [{ scale: 0.94 }],
};

export function MultiQrSelectionOverlay({
  symbols,
  onSelect,
  onCancel,
  onRefocus,
  imageUri,
  imageSize,
}: IMultiQrSelectionOverlayProps) {
  const intl = useIntl();
  const [layout, setLayout] = useState<IDimensions2D>({ width: 0, height: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const visible = symbols.length > 0;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  // Mobile haptics: light impact when entering multi-QR selection mode.
  useEffect(() => {
    if (!visible || !platformEnv.isNative) return;
    Haptics.impact(ImpactFeedbackStyle.Light);
  }, [visible]);

  useEffect(() => {
    if (!visible || platformEnv.isNative || typeof document === 'undefined') {
      return;
    }
    const entry = overlayStore.request({ blocking: false, dismissible: true });
    let ownsEscape = false;
    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.isComposing ||
        event.keyCode === 229
      ) {
        return;
      }
      if (event.type === 'keydown') {
        const top = overlayStore.resolveBack();
        ownsEscape = top.kind === 'dismiss' && top.id === entry.id;
      }
      if (!ownsEscape) return;
      event.preventDefault();
      if (event.type === 'keydown') {
        event.stopImmediatePropagation();
        return;
      }
      // Let the modal's back handler consume the keyup it observed on keydown.
      ownsEscape = false;
      cancelRef.current();
    };
    document.addEventListener('keydown', handleEscape, true);
    document.addEventListener('keyup', handleEscape, true);
    return () => {
      overlayStore.finalize(entry.id);
      document.removeEventListener('keydown', handleEscape, true);
      document.removeEventListener('keyup', handleEscape, true);
    };
  }, [visible]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const onBackdropPress = (event: GestureResponderEvent) => {
    if (!onRefocus) {
      onCancel();
      return;
    }
    const { nativeEvent, currentTarget } = event;
    let { locationX, locationY } = nativeEvent;
    let { width, height } = layout;
    if (Platform.select({ native: false, default: true })) {
      // React Native Web delivers a DOM click. Keyboard clicks have no position.
      if (
        !(nativeEvent instanceof MouseEvent) ||
        nativeEvent.detail === 0 ||
        !(currentTarget instanceof HTMLElement)
      ) {
        onRefocus();
        return;
      }
      const rect = currentTarget.getBoundingClientRect();
      ({ width, height } = rect);
      locationX = nativeEvent.clientX - rect.left;
      locationY = nativeEvent.clientY - rect.top;
    }
    if (
      width <= 0 ||
      height <= 0 ||
      !Number.isFinite(locationX) ||
      !Number.isFinite(locationY)
    ) {
      onRefocus();
      return;
    }
    onRefocus({
      x: Math.max(0, Math.min(1, locationX / width)),
      y: Math.max(0, Math.min(1, locationY / height)),
    });
  };

  const placedAnchors = useMemo(() => {
    if (!visible || layout.width <= 0 || layout.height <= 0) return [];
    const mappedSymbols =
      imageUri && imageSize && imageSize.width > 0 && imageSize.height > 0
        ? symbols.map((sym) => {
            const pt = mapImagePointToContainView(
              { x: sym.centerX, y: sym.centerY },
              imageSize,
              layout,
            );
            return { ...sym, centerX: pt.x, centerY: pt.y };
          })
        : symbols;
    return resolveRepelledAnchorPositions(
      mappedSymbols,
      layout.width,
      layout.height,
    );
  }, [imageSize, imageUri, layout, symbols, visible]);

  if (!visible) return null;

  return (
    <Stack
      style={rootStyle}
      onLayout={onLayout}
      testID="multi-qr-selection-overlay"
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          resizeMode="contain"
          style={stillImageStyle}
          testID="multi-qr-selection-image"
        />
      ) : null}

      <Pressable
        style={backdropStyle}
        onPress={onBackdropPress}
        accessibilityRole="button"
        accessibilityLabel={intl.formatMessage({
          id: onRefocus
            ? ETranslations.global_retry
            : ETranslations.global_cancel,
        })}
        testID="multi-qr-selection-backdrop"
      />

      {placedAnchors.map(({ symbol, x, y }, index) => {
        const isHovered = !platformEnv.isNative && hoveredIndex === index;
        const label = classifyMultiQrLabel(symbol.text);
        return (
          <Stack
            key={`${symbol.text}-${index}`}
            style={[
              dotWrapStyle,
              {
                left: x - DOT_SIZE / 2,
                top: y - DOT_SIZE / 2,
              },
            ]}
          >
            {isHovered ? (
              <Stack
                position="absolute"
                bottom={DOT_SIZE + 6}
                px="$2"
                py="$0.5"
                borderRadius="$2"
                bg="$blackA11"
                pointerEvents="none"
              >
                <SizableText
                  size="$bodySmMedium"
                  color="$whiteA12"
                  numberOfLines={1}
                >
                  {label}
                </SizableText>
              </Stack>
            ) : null}
            <Pressable
              hitSlop={DOT_HIT_SLOP}
              onPress={() => onSelect(symbol)}
              onHoverIn={() => setHoveredIndex(index)}
              onHoverOut={() =>
                setHoveredIndex((prev) => (prev === index ? null : prev))
              }
              accessibilityRole="button"
              accessibilityLabel={label}
              testID={`multi-qr-dot-${index}`}
              style={({ pressed }) => [
                dotCoreStyle,
                isHovered && dotCoreHoveredStyle,
                pressed && dotCorePressedStyle,
              ]}
            >
              <Icon name="ArrowRightOutline" size="$4.5" color="$whiteA12" />
            </Pressable>
          </Stack>
        );
      })}

      <YStack
        position="absolute"
        left="$3"
        right="$3"
        bottom="$3"
        alignItems="center"
        pointerEvents="box-none"
      >
        <Button
          size="small"
          variant="secondary"
          onPress={onCancel}
          testID="multi-qr-selection-cancel"
        >
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
      </YStack>
    </Stack>
  );
}
