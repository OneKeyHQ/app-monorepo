import { Keyboard } from 'react-native';

import { Button, XStack } from '@onekeyhq/components';
import SwapPercentageStageBadge from '@onekeyhq/kit/src/views/Swap/components/SwapPercentageStageBadge';

export function PercentageStageRow({
  onSelectPercentageStage,
  stageList,
}: {
  onSelectPercentageStage?: (stage: number) => void;
  stageList: number[];
}) {
  return (
    <XStack
      width="100%"
      alignItems="center"
      gap="$1"
      justifyContent="space-around"
      bg="$bgSubdued"
      h="$10"
    >
      {stageList.map((stage) => (
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
        testID="swap-stage-list-to-show-btn"
        icon="KeyboardDownOutline"
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
    </XStack>
  );
}
