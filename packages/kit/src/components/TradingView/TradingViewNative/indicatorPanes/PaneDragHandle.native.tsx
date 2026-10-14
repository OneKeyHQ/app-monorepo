import { useMemo, useRef } from 'react';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { SizableText, Stack } from '@onekeyhq/components';

import type { IPaneDragHandleProps } from './PaneDragHandle.types';

export function PaneDragHandle(props: IPaneDragHandleProps) {
  const current = useRef(props);
  current.current = props;
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        .onStart(() => current.current.onStart())
        .onUpdate((event) =>
          current.current.onDrag(event.translationY, false, false),
        )
        .onFinalize((event, success) =>
          current.current.onDrag(event.translationY, true, !success),
        ),
    [],
  );
  const { top, label, testID, mode, title } = props;
  return (
    <GestureDetector gesture={gesture}>
      <Stack
        testID={testID}
        accessibilityLabel={label}
        position="absolute"
        top={top}
        left={mode === 'resize' ? 0 : undefined}
        right={mode === 'resize' ? 0 : 68}
        height={mode === 'resize' ? 12 : 24}
        px={mode === 'move' ? '$1' : undefined}
        bg={mode === 'move' ? '$bgApp' : undefined}
        justifyContent="center"
        borderRadius="$1"
        zIndex={2}
      >
        {mode === 'resize' ? (
          <Stack height={1} bg="$borderSubdued" width="100%" />
        ) : (
          <SizableText size="$bodySm" color="$textSubdued">
            {title}
          </SizableText>
        )}
      </Stack>
    </GestureDetector>
  );
}
