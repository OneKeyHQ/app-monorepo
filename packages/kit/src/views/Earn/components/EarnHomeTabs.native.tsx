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
      {/* Content always mounted, toggle visibility to avoid remount flash */}
      <Stack flex={1} pt="$6" display={activeMode === 'earn' ? 'flex' : 'none'}>
        {earn}
      </Stack>
      <Stack
        flex={1}
        pt="$6"
        display={activeMode === 'borrow' ? 'flex' : 'none'}
      >
        {borrow}
      </Stack>
    </YStack>
  );
};
