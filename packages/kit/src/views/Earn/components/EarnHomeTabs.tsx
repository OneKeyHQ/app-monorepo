import { Stack, YStack } from '@onekeyhq/components';

import { MarketSelector, type IEarnHomeMode } from './MarketSelector';

export const EarnHomeTabs = ({
  earn,
  borrow,
  defaultMode = 'earn',
  onModeChange,
}: {
  earn: React.ReactNode;
  borrow: React.ReactNode;
  defaultMode?: IEarnHomeMode;
  onModeChange?: (mode: IEarnHomeMode) => void;
}) => {
  const activeMode = defaultMode;

  return (
    <YStack flex={1}>
      <MarketSelector mode={activeMode} onModeChange={onModeChange} />
      <Stack flex={1} pt="$4">
        {activeMode === 'earn' ? earn : borrow}
      </Stack>
    </YStack>
  );
};
