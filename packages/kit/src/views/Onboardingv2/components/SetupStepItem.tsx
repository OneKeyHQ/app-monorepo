import type { PropsWithChildren } from 'react';

import { Icon, XStack, YStack } from '@onekeyhq/components';

import { SetupCard } from './SetupCard';

export type ISetupStepState = 'pending' | 'inProgress' | 'done';

export interface ISetupStepItemProps extends PropsWithChildren {
  state: ISetupStepState;
  title: string;
  showConnector?: boolean;
}

export function SetupStepItem({
  children,
  showConnector,
  state,
  title,
}: ISetupStepItemProps) {
  const isInProgress = state === 'inProgress';
  return (
    <XStack gap="$3" pb={showConnector ? '$4' : 0}>
      <YStack w="$5" alignItems="center" pt="$5">
        <Icon
          name={
            state === 'done' ? 'CheckRadioSolid' : 'CirclePlaceholderOnOutline'
          }
          size="$5"
          color={state === 'pending' ? '$iconSubdued' : '$brand9'}
        />
        {showConnector ? (
          <YStack
            position="absolute"
            top={44}
            bottom={-20}
            w={2}
            bg={state === 'done' ? '$brand9' : '$neutral6'}
          />
        ) : null}
      </YStack>
      <SetupCard
        flex={1}
        elevated={isInProgress}
        title={title}
        titleColor={isInProgress ? '$brand9' : '$textSubdued'}
      >
        {isInProgress ? children : null}
      </SetupCard>
    </XStack>
  );
}
