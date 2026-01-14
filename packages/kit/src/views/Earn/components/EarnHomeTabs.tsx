import { Stack, YStack } from '@onekeyhq/components';

import { type IEarnHomeMode, MarketSelector } from './MarketSelector';

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
  const isEarnMode = activeMode === 'earn';
  const isBorrowMode = activeMode === 'borrow';

  return (
    <YStack flex={1}>
      <MarketSelector mode={activeMode} onModeChange={onModeChange} />
      <Stack flex={1} pt="$4">
        <Stack
          flex={1}
          display={isEarnMode ? 'flex' : 'none'}
          pointerEvents={isEarnMode ? 'auto' : 'none'}
        >
          {earn}
        </Stack>
        <Stack
          flex={1}
          display={isBorrowMode ? 'flex' : 'none'}
          pointerEvents={isBorrowMode ? 'auto' : 'none'}
        >
          {borrow}
        </Stack>
      </Stack>
    </YStack>
  );
};
