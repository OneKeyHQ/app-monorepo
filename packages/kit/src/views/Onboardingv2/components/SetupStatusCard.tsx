import type { IYStackProps } from '@onekeyhq/components';
import { Icon, SizableText, Spinner, YStack } from '@onekeyhq/components';

import { SetupCard, SetupCardBody } from './SetupCard';

export interface ISetupStatusCardProps extends IYStackProps {
  tone: 'checking' | 'ready';
  label: string;
}

export function SetupStatusCard({
  label,
  tone,
  ...rest
}: ISetupStatusCardProps) {
  return (
    <SetupCard elevated {...rest}>
      <SetupCardBody>
        <YStack h={240} gap="$5" alignItems="center" justifyContent="center">
          {tone === 'checking' ? (
            <Spinner size="large" />
          ) : (
            <Icon name="CheckRadioSolid" size="$9" color="$brand9" />
          )}
          <SizableText size="$headingMd" textAlign="center">
            {label}
          </SizableText>
        </YStack>
      </SetupCardBody>
    </SetupCard>
  );
}
