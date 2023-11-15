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
    <Stack bg="$bgApp" h={54} zIndex={1} display="flex">
      <Stack
        flex={1}
        flexDirection="row"
        overflow="hidden"
        mb={`${bottom}px`}
        alignItems="center"
        justifyContent="space-between"
        px={27}
      >
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ChevronLeftOutline"
          disabled={!canGoBack}
          onPress={goBack}
        />
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ChevronRightOutline"
          disabled={!canGoForward}
          onPress={goForward}
        />
        <IconButton
          variant="secondary"
          size="medium"
          icon="PlusLargeOutline"
          onPress={() => addBlankWebTab()}
        />
        <Button
          variant="tertiary"
          size="medium"
          borderWidth={1}
          borderColor="$border"
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
          <IconButton
            variant="tertiary"
            size="medium"
            icon="DotHorOutline"
            onPress={() => onOpenChange(true)}
          />
        </MobileBrowserBottomOptions>
      </Stack>
    </Stack>
  );
}

export default MobileBrowserBottomBar;
