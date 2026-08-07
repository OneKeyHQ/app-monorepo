import { useThemeName } from '@onekeyhq/components/src/hooks/useStyle';
import { TamaguiTheme as Theme } from '@onekeyhq/components/src/shared/tamagui';

import { HardwareDevice } from '../../content/HardwareDevice';
import { SizableText, YStack } from '../../primitives';
import { DialogV2 } from '../DialogV2';

import { REPLICA_WIDTH } from './consts';
import { ReplicaPort } from './ReplicaPort';

import type { IDeviceStageProps, IDeviceStageStep } from './type';

/**
 * A dark theater in both app themes, built two ways. Over a light app the
 * face is opaque near-black paint — translucency is what let the light theme
 * wash the glass out. Over a dark app the paint comes off and the system's
 * dark sheet material plays the stage itself: it is naturally deep there, and
 * it carries its own edge definition, which flat paint erases. The content
 * pins dark either way, and the port's mask dissolves the replica's foot the
 * same way over both faces. No footer: what happens next is decided on the
 * device, and stepping away is the sheet's own dismissal gesture.
 */

const STAGE_BG = '#0A0A0C';

/** Wallet grammar: an instruction-first title, one informative line under. */
const STEP_TEXT: Record<IDeviceStageStep, { title: string; sub?: string }> = {
  connecting: { title: 'Connecting…', sub: 'Keep your device nearby.' },
  enterPin: { title: 'Enter PIN on your device' },
  enterPassphrase: { title: 'Enter passphrase on your device' },
  confirm: { title: 'Confirm on your device' },
};

export function DeviceStage({
  open,
  onOpenChange,
  deviceType,
  step,
  confirmContext,
  locked,
}: IDeviceStageProps) {
  // Ambient theme, read outside the dark pin below: it decides whether the
  // sheet face needs paint at all.
  const ambientDark = useThemeName().includes('dark');
  const text = STEP_TEXT[step];
  const sub = (step === 'confirm' ? confirmContext : text.sub) ?? '';
  return (
    // The dark pin drives both the stage tokens and, through DialogV2's
    // ambient mirroring, the sheet chrome on native.
    <Theme name="dark">
      <DialogV2
        open={open}
        onOpenChange={onOpenChange}
        dismissible={!locked}
        background={ambientDark ? undefined : STAGE_BG}
      >
        <YStack pt="$4" px="$3">
          <ReplicaPort>
            {/* Step names and scene names deliberately coincide: every step
                is also the scene each replica plays of it (for some, a still
                device with a dark screen — exactly what the physical device
                shows at that moment). */}
            <HardwareDevice
              deviceType={deviceType}
              animation={step}
              width={REPLICA_WIDTH}
            />
          </ReplicaPort>
          {/* Tucked into the device foot so the words sit on it rather than
              under it. */}
          <YStack mt={-60} zIndex={1} gap="$1.5">
            <SizableText fontSize={24} lineHeight={30} fontWeight="700">
              {text.title}
            </SizableText>
            <SizableText
              fontSize={15}
              lineHeight={21}
              minHeight={21}
              color="$textSubdued"
            >
              {sub}
            </SizableText>
          </YStack>
        </YStack>
      </DialogV2>
    </Theme>
  );
}

export type { IDeviceStageProps, IDeviceStageStep } from './type';
