import { Stack, YStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  const flexProps = platformEnv.isDesktop ? undefined : { flex: 1 };

  return (
    <YStack {...flexProps}>
      <MarketSelector mode={activeMode} onModeChange={onModeChange} />
      <Stack {...flexProps} pt={24}>
        <Stack
          {...flexProps}
          display={isEarnMode ? 'flex' : 'none'}
          pointerEvents={isEarnMode ? 'auto' : 'none'}
        >
          {earn}
        </Stack>
        <Stack
          {...flexProps}
          display={isBorrowMode ? 'flex' : 'none'}
          pointerEvents={isBorrowMode ? 'auto' : 'none'}
        >
          {borrow}
        </Stack>
      </Stack>
    </YStack>
  );
};
