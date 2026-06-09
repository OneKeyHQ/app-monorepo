import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';

import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { IYStackProps } from '@onekeyhq/components';
import { SizableText, XStack, YStack } from '@onekeyhq/components';

import type { ImageSourcePropType } from 'react-native';

// The shared card shell for the device-setup UI (Figma: "SetupCard", the inner
// half of "SetupStep" = SetupConnector + SetupCard). Pure presentation.
//
// Three optional slots, each shown only when it has content — so the same shell
// serves both stepper rows and the standalone full-card states (status check /
// device ready / fallback) just by what you pass in:
//   - header: rendered iff `title` is set
//   - body:   `children`
//   - footer: rendered iff `instruction` is set (device thumbnail + one line)
//
// `elevated` paints the dark surface (bg + layered shadow + native border);
// leave it off for the collapsed pending/done rows, which are transparent.

// Layered drop shadow + inner edge highlight for the elevated card (web).
// Mirrors the popup shadow recipe used elsewhere in onboarding.
export const SETUP_CARD_SHADOW =
  'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.16), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18), 0 6px 6px -3px rgba(0, 0, 0, 0.18), 0 12px 12px -6px rgba(0, 0, 0, 0.18)';

const CARD_RADIUS = 24;

export interface ISetupCardGlowProps {
  // Gradient color (hex).
  color: string;
  // Diameter of the radial in px (default 466).
  size?: number;
  // Vertical offset relative to the container; negative bleeds it up out of the
  // card top (default -233).
  top?: number;
  // Peak alpha at the centre, fading to 0 at the edge (default 0.2).
  opacity?: number;
}

// Soft radial glow bleeding down from the top of a card, centered horizontally
// and clipped by the card's rounded overflow. Drawn with react-native-svg (the
// same primitive the onboarding HeroAtmosphere uses). Place it as the first
// child of a position:relative container (e.g. a SetupCardBody) so it sits
// behind the content.
export function SetupCardGlow({
  color,
  size = 466,
  top = -233,
  opacity = 0.2,
}: ISetupCardGlowProps) {
  const glowId = `setup-card-glow-${color.replace('#', '')}-${size}`;
  return (
    <YStack
      position="absolute"
      top={top}
      left="50%"
      x={-size / 2}
      w={size}
      h={size}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient
            id={glowId}
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
            fx="50%"
            fy="50%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${glowId})`} />
      </Svg>
    </YStack>
  );
}

// 40×40 framed device thumbnail shown in the footer. Mock placeholder until the
// real device image is wired (Pro 2 can't connect yet).
function SetupCardDeviceFrame() {
  return (
    <YStack
      w={40}
      h={40}
      borderRadius="$2"
      bg="$whiteA1"
      borderCurve="continuous"
      $platform-web={{
        boxShadow: SETUP_CARD_SHADOW,
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
      }}
      alignItems="center"
      overflow="hidden"
    >
      <YStack
        w={26}
        h={40}
        borderRadius="$1"
        borderCurve="continuous"
        bg="$whiteA1"
        borderWidth={1}
        borderColor="$whiteA1"
        y={7}
      />
    </YStack>
  );
}

// Open body slot with the card's standard horizontal padding so dropped-in
// content lines up with the header/footer; every prop is overridable.
export function SetupCardBody({
  children,
  ...rest
}: PropsWithChildren<IYStackProps>) {
  return (
    <YStack px="$5" pb="$6" {...rest}>
      {children}
    </YStack>
  );
}

export interface ISetupCardProps extends IYStackProps {
  // Header shows iff provided.
  title?: string;
  titleColor?: ComponentProps<typeof SizableText>['color'];
  // Footer shows iff provided — a device thumbnail + a one-line instruction.
  instruction?: string;
  deviceImage?: ImageSourcePropType;
  // Paint the dark surface (bg + shadow + native border). Off = transparent.
  elevated?: boolean;
  // Absolute background layer rendered behind header/body/footer and clipped by
  // the card's rounded overflow (e.g. a SetupCardBackground or SetupCardGlow).
  backgroundSlot?: ReactNode;
  children?: ReactNode;
}

export function SetupCard({
  title,
  titleColor = '$text',
  instruction,
  deviceImage,
  elevated,
  backgroundSlot,
  children,
  ...rest
}: ISetupCardProps) {
  const surfaceProps: IYStackProps | undefined = elevated
    ? {
        bg: '$bg',
        '$platform-web': { boxShadow: SETUP_CARD_SHADOW },
        '$platform-native': {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '$neutral3',
        },
      }
    : undefined;

  return (
    <YStack
      borderRadius={CARD_RADIUS}
      overflow="hidden"
      borderCurve="continuous"
      {...surfaceProps}
      {...rest}
    >
      {backgroundSlot}

      {title ? (
        <YStack p="$5">
          <SizableText size="$headingSm" color={titleColor}>
            {title}
          </SizableText>
        </YStack>
      ) : null}

      {children}

      {instruction ? (
        <XStack
          w="100%"
          alignItems="center"
          gap="$3"
          px="$5"
          pt={15}
          pb={14}
          bg="$whiteA1"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$neutral3"
        >
          {deviceImage ? <SetupCardDeviceFrame /> : null}
          <SizableText flex={1} size="$bodyMdMedium" color="$text">
            {instruction}
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
}
