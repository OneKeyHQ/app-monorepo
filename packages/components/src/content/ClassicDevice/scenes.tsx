import { useMemo } from 'react';
import type { ComponentType } from 'react';

import { Path, Rect, Svg } from 'react-native-svg';

import {
  useConfirmOnClassicAnimation,
  useEntryOnClassicAnimation,
} from './animation';
import { ENTRY_ROW_CY, EntryScreen } from './EntryScreen';
import { ClassicDeviceShell } from './shell';

import type { IEntryScreenProps } from './EntryScreen';

/**
 * Built-in scenes, keyed by the name ClassicDevice's `animation` prop takes.
 * A scene picks the choreography and the screen content; everything else
 * (shell, wake/sleep, key presses) is the shared vocabulary. Switching scenes
 * remounts, so the loop restarts from the top.
 */
export type IClassicDeviceScene = 'confirm' | 'enterPin' | 'enterPassphrase';

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
 * PIN and Passphrase differ only in glyphs; schedule, carets and the
 * final-confirm check come from the shared entry vocabulary. */

const renderDiamondEntered = (cx: number) => (
  <Rect
    x={-3.45}
    y={-3.45}
    width={6.9}
    height={6.9}
    rx={1.2}
    transform={`translate(${cx} ${ENTRY_ROW_CY}) rotate(45)`}
    fill="#fff"
  />
);

// Hollow diamond, sized so its outer edge matches the filled one.
const renderDiamondPending = (cx: number) => (
  <Rect
    x={-2.95}
    y={-2.95}
    width={5.9}
    height={5.9}
    rx={1}
    transform={`translate(${cx} ${ENTRY_ROW_CY}) rotate(45)`}
    stroke="#fff"
    strokeWidth={1.5}
  />
);

// Asterisk: three crossed strokes (masked character).
const renderAsteriskEntered = (cx: number) => (
  <Path
    d={`M${cx} ${ENTRY_ROW_CY - 3.8}L${cx} ${ENTRY_ROW_CY + 3.8}M${cx - 3.29} ${
      ENTRY_ROW_CY - 1.9
    }L${cx + 3.29} ${ENTRY_ROW_CY + 1.9}M${cx + 3.29} ${ENTRY_ROW_CY - 1.9}L${
      cx - 3.29
    } ${ENTRY_ROW_CY + 1.9}`}
    stroke="#fff"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

// Underscore on the row baseline.
const renderUnderscorePending = (cx: number) => (
  <Rect x={cx - 3.5} y={40.8} width={7} height={1.6} rx={0.8} fill="#fff" />
);

function EntryScene({
  width,
  title,
  renderEntered,
  renderPending,
}: ISceneProps &
  Pick<IEntryScreenProps, 'title' | 'renderEntered' | 'renderPending'>) {
  const { animation, clock } = useEntryOnClassicAnimation();
  const screenContent = useMemo(
    () => (
      <EntryScreen
        clock={clock}
        title={title}
        renderEntered={renderEntered}
        renderPending={renderPending}
      />
    ),
    [clock, title, renderEntered, renderPending],
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
      renderEntered={renderDiamondEntered}
      renderPending={renderDiamondPending}
    />
  );
}

function EnterPassphraseScene({ width }: ISceneProps) {
  return (
    <EntryScene
      width={width}
      title="Enter Passphrase"
      renderEntered={renderAsteriskEntered}
      renderPending={renderUnderscorePending}
    />
  );
}

export const SCENES: Record<IClassicDeviceScene, ComponentType<ISceneProps>> = {
  confirm: ConfirmScene,
  enterPin: EnterPinScene,
  enterPassphrase: EnterPassphraseScene,
};
