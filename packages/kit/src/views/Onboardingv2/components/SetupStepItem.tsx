import type { PropsWithChildren, ReactNode } from 'react';

import { Icon, XStack, YStack } from '@onekeyhq/components';

import { SetupCard } from './SetupCard';

import type { ImageSourcePropType } from 'react-native';

// Re-export so existing callers can keep importing the body slot from here.
export { SetupCardBody } from './SetupCard';

// A single row in the device-setup vertical stepper (Figma: "SetupStep" =
// SetupConnector + SetupCard). This file owns the left status column (state
// indicator icon + timeline rail); the card itself is the shared `SetupCard`.
//
// `state` lives only here and only drives: the indicator icon, the title color,
// whether the card is elevated, and whether the body/footer are revealed.
//
// States:
//   - pending:    hollow gray ring  + muted title  (flat card, title only)
//   - inProgress: hollow green ring + green title  (elevated card: header →
//                 body slot → footer with device + instruction)
//   - done:       filled green check + muted title  (flat card, title only)
export type ISetupStepState = 'pending' | 'inProgress' | 'done';

// Fixed pill count for the dotted rail — enough to overflow the tallest card,
// with the excess clipped by overflow:hidden. Hoisted so the array isn't
// reallocated on every render.
const CONNECTOR_DOTS = Array.from({ length: 60 });

// The 20×20 status dot at the head of each step.
function SetupStepIcon({ state }: { state: ISetupStepState }) {
  if (state === 'done') {
    return <Icon name="CheckRadioSolid" size="$5" color="$brand9" />;
  }
  return (
    <Icon
      name="CirclePlaceholderOnOutline"
      size="$5"
      color={state === 'inProgress' ? '$brand8' : '$iconSubdued'}
    />
  );
}

// Vertical timeline rail below the dot. Rendered as stacked pills (the
// cross-platform connector idiom used by the keyless step cards). Positioned
// absolutely so it adapts to the collapsed/expanded card height, and bleeds
// past the item bottom into the next item's dot so the timeline reads as one
// continuous line (items must be stacked with no gap between them).
function SetupStepConnectorLine({ state }: { state: ISetupStepState }) {
  const color = state === 'done' ? '$brand9' : '$neutral6';
  return (
    <YStack
      position="absolute"
      top={44}
      bottom={-36}
      left={9}
      w={2}
      gap="$1"
      overflow="hidden"
    >
      {CONNECTOR_DOTS.map((_, i) => (
        <YStack
          key={i}
          w="100%"
          h="$1"
          flexShrink={0}
          bg={color}
          borderRadius="$full"
        />
      ))}
    </YStack>
  );
}

export interface ISetupStepItemProps extends PropsWithChildren {
  state: ISetupStepState;
  title: string;
  // Show the left status column (state indicator icon + timeline rail).
  // Defaults to true; set false to render the card alone, full width.
  showIndicator?: boolean;
  // Draw the timeline rail down to the next step (hide on the last item).
  showConnector?: boolean;
  // Footer (InProgress only) — a device thumbnail + a one-line instruction.
  // The footer renders only when `instruction` is provided.
  instruction?: string;
  deviceImage?: ImageSourcePropType;
  // Absolute background layer for the InProgress card (e.g. SetupCardBackground).
  backgroundSlot?: ReactNode;
}

export function SetupStepItem({
  state,
  title,
  showIndicator = true,
  showConnector,
  instruction,
  deviceImage,
  backgroundSlot,
  children,
}: ISetupStepItemProps) {
  const isInProgress = state === 'inProgress';
  // The card's content slots (footer instruction, device thumbnail, background,
  // body) only apply to the expanded InProgress card; collapsed pending/done
  // rows render the title alone.
  const contentProps = isInProgress
    ? { instruction, deviceImage, backgroundSlot }
    : undefined;

  return (
    <XStack gap="$3" pb={showIndicator && showConnector ? '$5' : 0}>
      {/* Left status column: state indicator icon + timeline rail. */}
      {showIndicator ? (
        <YStack pt="$5">
          <SetupStepIcon state={state} />
          {showConnector ? <SetupStepConnectorLine state={state} /> : null}
        </YStack>
      ) : null}

      <SetupCard
        flex={1}
        elevated={isInProgress}
        title={title}
        titleColor={isInProgress ? '$brand9' : '$textSubdued'}
        {...contentProps}
      >
        {isInProgress ? children : null}
      </SetupCard>
    </XStack>
  );
}
