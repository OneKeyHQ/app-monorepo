import type { PropsWithChildren } from 'react';
import { useCallback, useEffect } from 'react';

import {
  AttachStep,
  TourBox as NativeTourBox,
  SpotlightTourProvider,
  flip,
  shift,
  useSpotlightTour,
} from 'react-native-spotlight-tour';

import { Trigger } from '../../actions';
import { useThemeValue } from '../../hooks';
import { Stack } from '../../primitives';

import type { IThemeColorKeys } from '../../hooks';
import type {
  AttachStepProps,
  SpotlightTourProviderProps,
  TourBoxProps,
  TourStep as TourStepType,
} from 'react-native-spotlight-tour';
import type { SizeTokens } from 'tamagui';

export type ISpotlightTourProviderProps = Omit<
  SpotlightTourProviderProps,
  'overlayColor'
> & {
  overlayColor?: IThemeColorKeys;
};
export function SpotlightTour({
  children,
  overlayColor,
  ...props
}: ISpotlightTourProviderProps) {
  const backdropOverlayColor = useThemeValue(overlayColor || 'bgBackdrop');
  return (
    <SpotlightTourProvider
      nativeDriver
      onBackdropPress="continue"
      overlayColor={backdropOverlayColor}
      overlayOpacity={1}
      floatingProps={{
        middleware: [flip(), shift()],
      }}
      {...props}
    >
      {children}
    </SpotlightTourProvider>
  );
}

export interface ITourStartProps {
  show?: boolean;
}
export function TourStart({ show }: { show: boolean }) {
  const { start } = useSpotlightTour();
  useEffect(() => {
    if (show) {
      start();
    }
  }, [show, start]);
  return null;
}

export type ITourTriggerProps = PropsWithChildren<{
  disabled?: boolean;
}>;

export function TourTrigger({ children, disabled }: ITourTriggerProps) {
  const { start } = useSpotlightTour();
  const handlePress = useCallback(() => {
    start();
  }, [start]);

  return (
    <Trigger onPress={handlePress} disabled={disabled}>
      {children}
    </Trigger>
  );
}

export type ITourStep = TourStepType;

export {
  // middleware
  // docs: https://floating-ui.com/docs/middleware
  flip,
  offset,
  shift,
  arrow,
  autoPlacement,
  hide,
  inline,
  // hooks
  useSpotlightTour,
} from 'react-native-spotlight-tour';

export interface ITourStepProps extends AttachStepProps<any> {
  width?: number | string | SizeTokens;
  height?: number | string | SizeTokens;
}
export function TourStep({
  children,
  width,
  height,
  ...props
}: ITourStepProps) {
  return width && height ? (
    <>
      <AttachStep {...props}>
        <Stack
          testID="step-ooooooo"
          width={width}
          height={height}
          pointerEvents="none"
          position="absolute"
          top={0}
          left={0}
        />
      </AttachStep>

      {children}
    </>
  ) : (
    <AttachStep {...props}>{children}</AttachStep>
  );
}

export type ITourBoxProps = TourBoxProps;
export function TourBox({ children, ...props }: ITourBoxProps) {
  return <NativeTourBox {...props}>{children}</NativeTourBox>;
}
