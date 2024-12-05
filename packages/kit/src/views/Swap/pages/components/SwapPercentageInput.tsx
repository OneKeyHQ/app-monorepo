import {
  AnimatePresence,
  Button,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { SwapPercentageInputStage } from '@onekeyhq/shared/types/swap/types';

const SwapPercentageInput = ({
  show,
  onSelectStage,
}: {
  show: boolean;
  onSelectStage?: (stage: number) => void;
}) => (
  <AnimatePresence>
    {show ? (
      <XStack
        animation="quick"
        enterStyle={{
          opacity: 0,
          x: 8,
        }}
        exitStyle={{
          opacity: 0,
          x: 4,
        }}
        gap="$1"
      >
        {SwapPercentageInputStage.map((stage) => (
          <Button
            height="$5"
            key={`swap-percentage-input-stage-${stage}`}
            size="small"
            onPress={() => onSelectStage?.(stage)}
          >
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {stage}%
            </SizableText>
          </Button>
        ))}
      </XStack>
    ) : null}
  </AnimatePresence>
);

export default SwapPercentageInput;
