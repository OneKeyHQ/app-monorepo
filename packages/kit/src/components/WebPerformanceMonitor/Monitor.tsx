/* eslint-disable no-param-reassign */
import { useEffect, useRef } from 'react';

import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import type { FrameInfo } from 'react-native-reanimated';

const isLowFps = (fps: number) => fps < 30;
const styles = StyleSheet.create({
  monitor: {
    userSelect: 'none',
    flexDirection: 'column', // Change to vertical layout
  },
  header: {
    fontSize: 14,
    color: '#000',
    paddingHorizontal: 5,
  },
  text: {
    userSelect: 'none',
    cursor: 'pointer',
    width: 60,
    fontSize: 13,
    color: '#000',
    paddingHorizontal: 3,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

type ICircularBuffer = ReturnType<typeof createCircularDoublesBuffer>;
function createCircularDoublesBuffer(size: number) {
  'worklet';

  return {
    next: 0 as number,
    buffer: new Float32Array(size),
    size,
    count: 0 as number,

    push(value: number): number | null {
      const oldValue = this.buffer[this.next];
      const oldCount = this.count;
      this.buffer[this.next] = value;

      this.next = (this.next + 1) % this.size;
      this.count = Math.min(this.size, this.count + 1);
      return oldCount === this.size ? oldValue : null;
    },

    front(): number | null {
      const notEmpty = this.count > 0;
      if (notEmpty) {
        const current = this.next - 1;
        const index = current < 0 ? this.size - 1 : current;
        return this.buffer[index];
      }
      return null;
    },

    back(): number | null {
      const notEmpty = this.count > 0;
      return notEmpty ? this.buffer[this.next] : null;
    },
  };
}

const DEFAULT_BUFFER_SIZE = 20;
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

let requestAnimationFrameId: number | null = null;
function loopAnimationFrame(fn: (lastTime: number, time: number) => void) {
  let lastTime = 0;

  function loop() {
    requestAnimationFrame((time) => {
      if (lastTime > 0) {
        fn(lastTime, time);
      }
      lastTime = time;
      requestAnimationFrameId = requestAnimationFrame(loop);
    });
  }

  loop();
}

function getFps(renderTimeInMs: number): number {
  'worklet';

  return 1000 / renderTimeInMs;
}

function completeBufferRoutine(
  buffer: ICircularBuffer,
  timestamp: number,
): number {
  'worklet';

  timestamp = Math.round(timestamp);

  const droppedTimestamp = buffer.push(timestamp) ?? timestamp;

  const measuredRangeDuration = timestamp - droppedTimestamp;

  return getFps(measuredRangeDuration / buffer.count);
}

function JsPerformance({ smoothingFrames }: { smoothingFrames: number }) {
  const jsFps = useSharedValue<string | null>(null);
  const totalRenderTime = useSharedValue(0);
  const circularBuffer = useRef<ICircularBuffer>(
    createCircularDoublesBuffer(smoothingFrames),
  );

  useEffect(() => {
    loopAnimationFrame((_, timestamp) => {
      timestamp = Math.round(timestamp);

      const currentFps = completeBufferRoutine(
        circularBuffer.current,
        timestamp,
      );

      // JS fps have to be measured every 2nd frame,
      // thus 2x multiplication has to occur here
      jsFps.value = (currentFps * 2).toFixed(0);
    });

    return () => {
      if (requestAnimationFrameId) {
        cancelAnimationFrame(requestAnimationFrameId);
        requestAnimationFrameId = null;
      }
    };
  }, [jsFps, totalRenderTime]);

  const animatedProps = useAnimatedProps(() => {
    const text = `JS: ${jsFps.value ?? 'N/A'} `;
    return { text, defaultValue: text };
  });

  const animatedStyle = useAnimatedStyle(() => {
    const value = jsFps.value;
    const isLow = isLowFps(Number(value));
    return {
      color: isLow ? 'red' : '#000',
      fontWeight: isLow ? 800 : 500,
    };
  });

  return (
    <View style={styles.container}>
      <AnimatedTextInput
        style={[styles.text, animatedStyle]}
        animatedProps={animatedProps}
        editable={false}
      />
    </View>
  );
}

function UiPerformance({ smoothingFrames }: { smoothingFrames: number }) {
  const uiFps = useSharedValue<string | null>(null);
  const circularBuffer = useSharedValue<ICircularBuffer | null>(null);

  useFrameCallback(({ timestamp }: FrameInfo) => {
    if (circularBuffer.value === null) {
      circularBuffer.value = createCircularDoublesBuffer(smoothingFrames);
    }

    timestamp = Math.round(timestamp);

    const currentFps = completeBufferRoutine(circularBuffer.value, timestamp);

    uiFps.value = currentFps.toFixed(0);
  });

  const animatedProps = useAnimatedProps(() => {
    const value = uiFps.value;
    const text = `UI: ${value ?? 'N/A'} `;
    // Highlight in red and bold if value is less than 30
    return { text, defaultValue: text };
  });

  const animatedStyle = useAnimatedStyle(() => {
    const value = uiFps.value;
    const isLow = isLowFps(Number(value));
    return {
      color: isLow ? 'red' : '#000',
      fontWeight: isLow ? 800 : 500,
    };
  });

  return (
    <View style={styles.container}>
      <AnimatedTextInput
        style={[styles.text, animatedStyle]}
        animatedProps={animatedProps}
        editable={false}
      />
    </View>
  );
}

export type IPerformanceMonitorProps = {
  /**
   * Sets amount of previous frames used for smoothing at highest expectedFps.
   *
   * Automatically scales down at lower frame rates.
   *
   * Affects jumpiness of the FPS measurements value.
   */
  smoothingFrames?: number;
};

/**
 * A component that lets you measure fps values on JS and UI threads on both the
 * Paper and Fabric architectures.
 *
 * @param smoothingFrames - Determines amount of saved frames which will be used
 *   for fps value smoothing.
 */
export function PerformanceMonitor({
  smoothingFrames = DEFAULT_BUFFER_SIZE,
}: IPerformanceMonitorProps) {
  return (
    <View style={styles.monitor}>
      <JsPerformance smoothingFrames={smoothingFrames} />
      <UiPerformance smoothingFrames={smoothingFrames} />
    </View>
  );
}
