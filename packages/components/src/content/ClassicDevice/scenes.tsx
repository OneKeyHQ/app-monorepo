import { useMemo } from 'react';
import type { ComponentType, ReactNode } from 'react';

import { Path, Rect, Svg } from 'react-native-svg';

import {
  useConfirmOnClassicAnimation,
  useEntryOnClassicAnimation,
} from './animation';
import { EntryScreen } from './EntryScreen';
import { ClassicDeviceShell } from './shell';

/**
 * Built-in scenes, keyed by the name ClassicDevice's `animation` prop takes.
 * A scene picks the choreography and the screen content; everything else
 * (shell, wake/sleep, key presses) is the shared vocabulary. Switching scenes
 * remounts, so the loop restarts from the top.
 */
export type IClassicDeviceScene =
  | 'connecting'
  | 'confirm'
  | 'enterPin'
  | 'enterPassphrase';

interface ISceneProps {
  width?: number;
}

/* ------------------------- confirm ------------------------- *
 * Confirmation scenarios are unbounded, so the screen abstracts to skeleton
 * structure: a title pill, two body bars, and literal x / check corner
 * glyphs - the invariants of every confirm screen. */

const CONFIRM_SKELETON = (
  <Svg width="100%" height="100%" viewBox="0 0 128 64" fill="none">
    <Rect
      x={32}
      y={3}
      width={64}
      height={10}
      rx={5}
      fill="#fff"
      fillOpacity={0.59}
    />
    <Rect
      x={18}
      y={23}
      width={92}
      height={7}
      rx={3.5}
      fill="#fff"
      fillOpacity={0.28}
    />
    <Rect
      x={36}
      y={35}
      width={56}
      height={7}
      rx={3.5}
      fill="#fff"
      fillOpacity={0.28}
    />
    <Path
      d="M6.5 53.5L12.5 59.5M12.5 53.5L6.5 59.5"
      stroke="#fff"
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <Path
      d="M113.5 57L116.4 59.8L121.5 53.6"
      stroke="#fff"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

function ConfirmScene({ width }: ISceneProps) {
  const animation = useConfirmOnClassicAnimation();
  return (
    <ClassicDeviceShell
      width={width}
      animation={animation}
      screenContent={CONFIRM_SKELETON}
    />
  );
}

/* ---------------------- character entry ---------------------- *
 * PIN and Passphrase differ only in glyphs, each authored around its slot
 * origin; schedule, carets and the final-confirm check come from the shared
 * entry vocabulary. */

const DIAMOND_ENTERED = (
  <Rect
    x={-3.45}
    y={-3.45}
    width={6.9}
    height={6.9}
    rx={1.2}
    transform="rotate(45)"
    fill="#fff"
  />
);

// Hollow diamond, sized so its outer edge matches the filled one.
const DIAMOND_PENDING = (
  <Rect
    x={-2.95}
    y={-2.95}
    width={5.9}
    height={5.9}
    rx={1}
    transform="rotate(45)"
    stroke="#fff"
    strokeWidth={1.5}
  />
);

// Asterisk: three crossed strokes (masked character).
const ASTERISK_ENTERED = (
  <Path
    d="M0 -3.8L0 3.8M-3.29 -1.9L3.29 1.9M3.29 -1.9L-3.29 1.9"
    stroke="#fff"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

// Underscore, sitting just below the row centre.
const UNDERSCORE_PENDING = (
  <Rect x={-3.5} y={2.3} width={7} height={1.6} rx={0.8} fill="#fff" />
);

function EntryScene({
  width,
  title,
  enteredGlyph,
  pendingGlyph,
}: ISceneProps & {
  title: string;
  enteredGlyph: ReactNode;
  pendingGlyph: ReactNode;
}) {
  const { animation, entered, fillCount } = useEntryOnClassicAnimation();
  const screenContent = useMemo(
    () => (
      <EntryScreen
        entered={entered}
        fillCount={fillCount}
        title={title}
        enteredGlyph={enteredGlyph}
        pendingGlyph={pendingGlyph}
      />
    ),
    [entered, fillCount, title, enteredGlyph, pendingGlyph],
  );
  return (
    <ClassicDeviceShell
      width={width}
      animation={animation}
      screenContent={screenContent}
    />
  );
}

function EnterPinScene({ width }: ISceneProps) {
  return (
    <EntryScene
      width={width}
      title="Enter PIN"
      enteredGlyph={DIAMOND_ENTERED}
      pendingGlyph={DIAMOND_PENDING}
    />
  );
}

function EnterPassphraseScene({ width }: ISceneProps) {
  return (
    <EntryScene
      width={width}
      title="Enter Passphrase"
      enteredGlyph={ASTERISK_ENTERED}
      pendingGlyph={UNDERSCORE_PENDING}
    />
  );
}

/* ------------------------- connecting ------------------------- *
 * While the app is reaching for the device the physical screen shows
 * nothing, so the scene is the still shell with the OLED dark. */

function ConnectingScene({ width }: ISceneProps) {
  return <ClassicDeviceShell width={width} />;
}

export const SCENES: Record<IClassicDeviceScene, ComponentType<ISceneProps>> = {
  connecting: ConnectingScene,
  confirm: ConfirmScene,
  enterPin: EnterPinScene,
  enterPassphrase: EnterPassphraseScene,
};
