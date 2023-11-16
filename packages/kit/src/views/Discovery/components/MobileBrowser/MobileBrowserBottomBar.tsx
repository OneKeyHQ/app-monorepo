import { useState } from 'react';

import { IconButton, Stack, Text } from '@onekeyhq/components';
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
        <Stack
          p="$2"
          borderRadius="$full"
          pressStyle={{
            bg: '$bgActive',
          }}
          onPress={() => {
            onShowTabList();
          }}
        >
          <Stack
            minWidth="$5"
            minHeight="$5"
            p={tabCount.toString().length > 1 ? '$1' : undefined}
            borderRadius="$1"
            borderWidth="$0.5"
            borderColor="$iconSubdued"
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
          >
            <Text variant="$bodySmMedium" color="$iconSubdued">
              {tabCount}
            </Text>
          </Stack>
        </Stack>
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
