import { useMemo, useState } from 'react';

import { ClassicDevice } from '.';

import { StyleSheet, View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { Path, Rect, Svg } from 'react-native-svg';

import { SizableText } from '../../primitives';

import {
  PIN_FILL_COUNT,
  pinEnteredAt,
  useEnterPinOnClassicAnimation,
} from './animation';

import type { SharedValue } from 'react-native-reanimated';

/**
 * Enter PIN scene. The title is literal text in the app font (the scenario is
 * specific, unlike confirm's skeleton). The row speaks one diamond language:
 * hollow = pending, filled = entered, and the check replaces the cursor's
 * hollow diamond only once all six digits are in - the final OK press is the
 * confirm. Smooth vector on the 128x64 screen coordinate system.
 */

const SLOT_N = 9;
const SLOT_PITCH = 13;
const ROW_CY = 38.5;
const slotX = (i: number) => 64 + (i - 4) * SLOT_PITCH;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  title: {
    position: 'absolute',
    // Screen-relative 20 minus the content slot's 12pt top offset.
    top: 8,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});

function PinSlot({ index, entered }: { index: number; entered: number }) {
  const cx = slotX(index);
  const cursor = Math.min(entered, SLOT_N - 1);
  if (index < entered) {
    return (
      <Rect
        x={-3.45}
        y={-3.45}
        width={6.9}
        height={6.9}
        rx={1.2}
        transform={`translate(${cx} ${ROW_CY}) rotate(45)`}
        fill="#fff"
      />
    );
  }
  if (index === cursor && entered >= PIN_FILL_COUNT) {
    return (
      <Path
        d={`M${cx - 3.3} ${ROW_CY + 0.3}L${cx - 0.9} ${ROW_CY + 2.7}L${
          cx + 3.5
        } ${ROW_CY - 2.9}`}
        stroke="#fff"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  // Hollow diamond, sized so its outer edge matches the filled one.
  return (
    <Rect
      x={-2.95}
      y={-2.95}
      width={5.9}
      height={5.9}
      rx={1}
      transform={`translate(${cx} ${ROW_CY}) rotate(45)`}
      stroke="#fff"
      strokeWidth={1.5}
    />
  );
}

function PinCarets({ entered }: { entered: number }) {
  const cx = slotX(Math.min(entered, SLOT_N - 1));
  return (
    <>
      <Path
        d={`M${cx - 2.7} ${ROW_CY - 9.2}L${cx} ${ROW_CY - 11.6}L${cx + 2.7} ${
          ROW_CY - 9.2
        }`}
        stroke="#fff"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={`M${cx - 2.7} ${ROW_CY + 9.2}L${cx} ${ROW_CY + 11.6}L${cx + 2.7} ${
          ROW_CY + 9.2
        }`}
        stroke="#fff"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

// Owns the discrete entered state so fills only re-render this small subtree,
// never the 76-element device body (its screenContent stays referentially
// stable).
function PinScreen({ clock }: { clock: Readonly<SharedValue<number>> }) {
  const [entered, setEntered] = useState(0);
  useAnimatedReaction(
    () => pinEnteredAt(clock.value),
    (value, previous) => {
      if (value !== previous) runOnJS(setEntered)(value);
    },
    [clock],
  );
  return (
    <View style={styles.fill}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 128 64"
        fill="none"
        style={StyleSheet.absoluteFill}
      >
        {Array.from({ length: SLOT_N }, (_, i) => (
          <PinSlot key={i} index={i} entered={entered} />
        ))}
        <PinCarets entered={entered} />
      </Svg>
      <SizableText
        style={styles.title}
        color="#fff"
        fontSize={20}
        lineHeight={24}
        fontWeight="500"
      >
        Enter PIN
      </SizableText>
    </View>
  );
}

export interface IEnterPinOnClassicProps {
  /** Same contract as ClassicDevice: rendered width in points. */
  width?: number;
}

export function EnterPinOnClassic({ width }: IEnterPinOnClassicProps) {
  const { animation, clock } = useEnterPinOnClassicAnimation();
  const screenContent = useMemo(() => <PinScreen clock={clock} />, [clock]);
  return (
    <ClassicDevice
      width={width}
      animation={animation}
      screenContent={screenContent}
    />
  );
}
