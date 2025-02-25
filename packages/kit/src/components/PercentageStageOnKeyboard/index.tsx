import { Keyboard } from 'react-native';

import { Button, XStack, useIsKeyboardShown } from '@onekeyhq/components';
import SwapPercentageStageBadge from '@onekeyhq/kit/src/views/Swap/components/SwapPercentageStageBadge';

export const PercentageInputStageForNative = [25, 50, 75, 100];

export function PercentageStageOnKeyboard({
  onSelectPercentageStage,
}: {
  onSelectPercentageStage?: (stage: number) => void;
}) {
  const isShow = useIsKeyboardShown();
  return isShow ? (
    <XStack
      alignItems="center"
      gap="$1"
      justifyContent="space-around"
      bg="$bgSubdued"
      h="$10"
    >
      <>
        {PercentageInputStageForNative.map((stage) => (
          <SwapPercentageStageBadge
            badgeSize="lg"
            key={`swap-percentage-input-stage-${stage}`}
            stage={stage}
            borderRadius={0}
            onSelectStage={onSelectPercentageStage}
            flex={1}
            justifyContent="center"
            alignItems="center"
            h="$10"
          />
        ))}
        <Button
          icon="CheckLargeOutline"
          flex={1}
          h="$10"
          size="small"
          justifyContent="center"
          borderRadius={0}
          alignItems="center"
          variant="tertiary"
          onPress={() => {
            Keyboard.dismiss();
          }}
        />
      </>
    </XStack>
  ) : null;
}
