import { useCallback, useMemo, useState } from 'react';

import { Button, SizableText, XStack, YStack } from '../../primitives';
import { BottomSheet } from '../BottomSheet';

/**
 * The on-device playground for the sheet's whole surface: dismissible,
 * background paint, background interactivity — and, through the grow and
 * shrink buttons, the content-sized height contract itself (each press
 * changes the content in one piece; the sheet rides its own detent
 * animation to follow). Kept apart from the story file so the web shell
 * loads the stand-in instead of @expo/ui.
 */
import type { IBottomSheetDemoProps } from './type';

/** Sections of filler content: the lever for playing with the height. */
const MAX_SECTIONS = 4;

export function BottomSheetDemo({
  dismissible,
  background,
  backgroundInteractive,
  snapPoints,
}: IBottomSheetDemoProps) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState(1);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleGrow = useCallback(
    () => setSections((count) => Math.min(MAX_SECTIONS, count + 1)),
    [],
  );
  const handleShrink = useCallback(
    () => setSections((count) => Math.max(1, count - 1)),
    [],
  );
  const sectionList = useMemo(
    () => Array.from({ length: sections }, (_, index) => index + 1),
    [sections],
  );
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button testID="bottom-sheet-demo-open" onPress={handleOpen}>
        Open sheet
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        dismissible={dismissible}
        background={background}
        backgroundInteractive={backgroundInteractive}
        snapPoints={snapPoints}
      >
        <YStack gap="$4">
          <YStack gap="$1">
            <SizableText size="$headingLg">Content-sized sheet</SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              The sheet stands at whatever the content measures. Grow or shrink
              it and the height rides the system's own animation.
            </SizableText>
            {snapPoints?.length ? (
              <SizableText size="$bodySm" color="$textCritical">
                Snap points are set: they own the height now — drag the sheet
                between its stops; Grow and Shrink no longer move it.
              </SizableText>
            ) : null}
          </YStack>
          {sectionList.map((section) => (
            <YStack
              key={section}
              height={72}
              borderRadius="$3"
              bg="$bgSubdued"
              alignItems="center"
              justifyContent="center"
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                Section {section}
              </SizableText>
            </YStack>
          ))}
          <XStack gap="$2.5">
            <Button
              testID="bottom-sheet-demo-grow"
              variant="primary"
              disabled={sections === MAX_SECTIONS}
              onPress={handleGrow}
            >
              Grow
            </Button>
            <Button
              testID="bottom-sheet-demo-shrink"
              disabled={sections === 1}
              onPress={handleShrink}
            >
              Shrink
            </Button>
            <Button testID="bottom-sheet-demo-close" onPress={handleClose}>
              Close
            </Button>
          </XStack>
        </YStack>
      </BottomSheet>
    </YStack>
  );
}
