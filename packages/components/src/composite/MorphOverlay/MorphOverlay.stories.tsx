import { useCallback, useMemo, useState } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  MorphOverlay,
  useMorphOverlay,
} from '@onekeyhq/components/src/composite/MorphOverlay';
import type { IMorphOverlayPose } from '@onekeyhq/components/src/composite/MorphOverlay';
import { Portal } from '@onekeyhq/components/src/hocs/Portal';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { Icon } from '@onekeyhq/components/src/primitives/Icon';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import {
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { LayoutChangeEvent } from 'react-native';

/**
 * The container on its own, with stand-in content — a capsule row and
 * two card columns of different heights — so the morph, the crossing
 * and the height re-aim can be watched, and the chrome (scrim, grabber,
 * close button, drag-to-dismiss, the modal wall) tried, without the
 * device stage's vocabulary in the way. The controls are the
 * component's own props; the buttons are the caller's content changes.
 */

type IDemoContent = 'hidden' | 'waiting' | 'short' | 'tall';

const POSE_OF: Record<IDemoContent, IMorphOverlayPose> = {
  hidden: 'hidden',
  waiting: 'capsule',
  short: 'card',
  tall: 'card',
};

const TALL_LINES = [
  'A taller column, so the crossing from the short card re-aims the height on the empty beat.',
  'Every block here is measured by the caller; the container only adds its toolbar band and its chin.',
  'Drag the card down to dismiss it, or tap the close button — both exist only while the grant is on.',
];

/** First-frame stand-in for an unmeasured column. */
const COLUMN_ESTIMATED_HEIGHT = 120;

function Demo({
  modal,
  scrim,
  dismissible,
}: {
  /** The wall over the app behind while the shell is there. */
  modal: boolean;
  /** The dark scrim over the blocked app (implies the wall). */
  scrim: boolean;
  /** The close grant: close buttons, grabber drag, tap outside. */
  dismissible: boolean;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [content, setContent] = useState<IDemoContent>('hidden');
  const morph = useMorphOverlay<IDemoContent>({
    value: content,
    pose: POSE_OF[content],
    key: content,
  });
  const { shown } = morph;

  // Each card column reports its own height; the shown one is the
  // height target, the way DeviceStage sums its measured blocks.
  const [columnHeights, setColumnHeights] = useState<
    Partial<Record<IDemoContent, number>>
  >({});
  const reportColumn = useCallback(
    (name: IDemoContent, event: LayoutChangeEvent) => {
      const next = Math.ceil(event.nativeEvent.layout.height);
      setColumnHeights((current) =>
        current[name] === next ? current : { ...current, [name]: next },
      );
    },
    [],
  );
  const onShortLayout = useCallback(
    (event: LayoutChangeEvent) => reportColumn('short', event),
    [reportColumn],
  );
  const onTallLayout = useCallback(
    (event: LayoutChangeEvent) => reportColumn('tall', event),
    [reportColumn],
  );
  const shownColumn = shown === 'short' || shown === 'tall' ? shown : undefined;
  const shownHeight = shownColumn ? columnHeights[shownColumn] : undefined;

  const goHidden = useCallback(() => setContent('hidden'), []);
  const goWaiting = useCallback(() => setContent('waiting'), []);
  const goShort = useCallback(() => setContent('short'), []);
  const goTall = useCallback(() => setContent('tall'), []);

  const capsule = useMemo(
    () => (
      <XStack px="$2" gap="$3" alignItems="center">
        <Stack w={40} h={40} alignItems="center" justifyContent="center">
          <Icon name="BluetoothOutline" size="$6" color="$iconSubdued" />
        </Stack>
        <YStack>
          <SizableText size="$headingMd">Waiting…</SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            Stand-in device
          </SizableText>
        </YStack>
      </XStack>
    ),
    [],
  );
  const seats = useMemo(
    () => [
      {
        key: 'short',
        active: shown === 'short',
        node: (
          <YStack onLayout={onShortLayout} gap="$4">
            <YStack gap="$1">
              <SizableText size="$heading2xl">Short card</SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                One title, one line, one button.
              </SizableText>
            </YStack>
            <Button
              testID="morph-overlay-demo-short-action"
              variant="primary"
              size="large"
              onPress={goTall}
            >
              Cross to the tall card
            </Button>
          </YStack>
        ),
      },
      {
        key: 'tall',
        active: shown === 'tall',
        node: (
          <YStack onLayout={onTallLayout} gap="$4">
            <YStack gap="$1">
              <SizableText size="$heading2xl">Tall card</SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                Same pose, more height.
              </SizableText>
            </YStack>
            {TALL_LINES.map((line) => (
              <SizableText key={line} size="$bodyLg" color="$textSubdued">
                {line}
              </SizableText>
            ))}
            <Button
              testID="morph-overlay-demo-tall-action"
              variant="primary"
              size="large"
              onPress={goWaiting}
            >
              Back to the capsule
            </Button>
          </YStack>
        ),
      },
    ],
    [goTall, goWaiting, onShortLayout, onTallLayout, shown],
  );

  // The story's host, the stage stories' own: the overlay anchored to
  // the bottom of a canvas kept tall enough (window minus a
  // workbench-chrome allowance), and the buttons on the same portal,
  // mounted after it and so above its wall — a bar along the canvas top.
  const bar = useMemo(
    () => (
      <XStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        p="$2"
        gap="$2"
        flexWrap="wrap"
        pointerEvents="box-none"
      >
        <Button
          testID="morph-overlay-demo-hidden"
          variant={content === 'hidden' ? 'primary' : undefined}
          onPress={goHidden}
        >
          Hidden
        </Button>
        <Button
          testID="morph-overlay-demo-capsule"
          variant={content === 'waiting' ? 'primary' : undefined}
          onPress={goWaiting}
        >
          Capsule
        </Button>
        <Button
          testID="morph-overlay-demo-short"
          variant={content === 'short' ? 'primary' : undefined}
          onPress={goShort}
        >
          Card · short
        </Button>
        <Button
          testID="morph-overlay-demo-tall"
          variant={content === 'tall' ? 'primary' : undefined}
          onPress={goTall}
        >
          Card · tall
        </Button>
      </XStack>
    ),
    [content, goHidden, goShort, goTall, goWaiting],
  );
  return (
    <Stack minHeight={windowHeight - 190}>
      <MorphOverlay
        morph={morph}
        cardInnerHeight={shownHeight ?? COLUMN_ESTIMATED_HEIGHT}
        cardContentMeasured={shownHeight !== undefined}
        onDismiss={dismissible ? goHidden : undefined}
        modal={modal}
        scrim={scrim}
        capsuleKey="waiting"
        capsule={capsule}
        seats={seats}
      />
      <Portal.Body container={Portal.Constant.HARDWARE_UI_STATE_DIALOG}>
        {bar}
      </Portal.Body>
    </Stack>
  );
}

const meta = {
  title: 'Composite/MorphOverlay',
  component: Demo,
  args: {
    modal: false,
    scrim: false,
    dismissible: true,
  },
  argTypes: {
    modal: { control: 'boolean' },
    scrim: { control: 'boolean' },
    dismissible: { control: 'boolean' },
  },
} satisfies Meta<typeof Demo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: Demo,
};
