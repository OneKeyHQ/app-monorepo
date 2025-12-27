import { useMemo } from 'react';

import { SegmentControl, Stack, YStack } from '@onekeyhq/components';

type IEarnHomeMode = 'earn' | 'borrow';

// FIXME[borrow]: earn/borrow i18n
const MODE_OPTIONS = [
  { label: 'Earn', value: 'earn' as const },
  { label: 'Borrow', value: 'borrow' as const },
];

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

  const options = useMemo(() => MODE_OPTIONS, []);

  return (
    <YStack flex={1} pt="$2">
      <Stack px="$5">
        <SegmentControl
          value={activeMode}
          options={options}
          onChange={(value) => onModeChange?.(value as IEarnHomeMode)}
        />
      </Stack>
      {/* Conditional rendering to avoid Tabs context issues */}
      <Stack flex={1} pt="$6">
        {activeMode === 'earn' ? earn : borrow}
      </Stack>
    </YStack>
  );
};
