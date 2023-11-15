import { useState } from 'react';

import { Button, IconButton, Stack } from '@onekeyhq/components';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';

import useWebTabAction from '../../hooks/useWebTabAction';

import MobileBrowserBottomOptions from './MobileBrowserBottomOptions';

import type { IMobileBottomOptionsProps } from '../../types';

function MobileBrowserBottomBar({
  goBack,
  goForward,
  canGoBack,
  canGoForward,
  tabCount,
  onShowTabList,
  ...rest
}: {
  id: string;
  tabCount: number;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onShowTabList: () => void;
} & IMobileBottomOptionsProps) {
  const { bottom } = useSafeAreaInsets();

  const { addBlankWebTab } = useWebTabAction();
  const [open, onOpenChange] = useState(false);
  return (
    <Stack bg="$bgActiveDark" height="$14" zIndex={1} display="flex">
      <Stack
        flex={1}
        flexDirection="row"
        overflow="hidden"
        mb={`${bottom}px`}
        alignItems="center"
        justifyContent="space-between"
      >
        <IconButton
          icon="ArrowLeftOutline"
          disabled={!canGoBack}
          onPress={goBack}
        />
        <IconButton
          icon="ArrowTopOutline"
          disabled={!canGoForward}
          onPress={goForward}
        />
        <IconButton icon="PlusLargeOutline" onPress={() => addBlankWebTab()} />
        <Button
          onPress={() => {
            onShowTabList();
          }}
        >
          {tabCount}
        </Button>
        <MobileBrowserBottomOptions
          open={open}
          onOpenChange={onOpenChange}
          {...rest}
        >
          <IconButton icon="MoreIllus" onPress={() => onOpenChange(true)} />
        </MobileBrowserBottomOptions>
      </Stack>
    </Stack>
  );
}

export default MobileBrowserBottomBar;
