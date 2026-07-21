import type { IYStackProps } from '@onekeyhq/components';
import { Icon, SizableText, Spinner, YStack } from '@onekeyhq/components';

import { SetupCard, SetupCardBody } from './SetupCard';
import { SetupCardBackground } from './SetupCardBackground';

// The standalone, full-card states that bracket the stepper (Figma "Device
// status check" / "Device is ready"). They have no step state and no left
// indicator — just an elevated SetupCard with a centered icon + label over a
// background effect (web shimmer / native glow), themed by tone:
//   - checking → neutral background + spinner
//   - ready    → brand-green background + check
// Both share one layout; only the icon, label and background variant differ.

type ISetupStatusTone = 'checking' | 'ready';

export interface ISetupStatusCardProps extends IYStackProps {
  tone: ISetupStatusTone;
  label: string;
}

export function SetupStatusCard({
  tone,
  label,
  ...rest
}: ISetupStatusCardProps) {
  return (
    <SetupCard
      elevated
      {...rest}
      backgroundSlot={
        <SetupCardBackground variant={tone === 'ready' ? 'brand' : 'neutral'} />
      }
    >
      <SetupCardBody alignItems="center">
        <YStack
          h={240}
          pt="$6"
          gap="$5"
          alignItems="center"
          justifyContent="center"
        >
          {tone === 'checking' ? (
            <Spinner size="large" />
          ) : (
            <Icon name="CheckRadioSolid" size="$9" color="$brand9" />
          )}
          <SizableText size="$headingMd" color="$text">
            {label}
          </SizableText>
        </YStack>
      </SetupCardBody>
    </SetupCard>
  );
}
