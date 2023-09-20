// https://gist.github.com/nandorojo/8fd2b0f5bd5e75073dcce5a17a6346e4

import { useEffect, useRef, useState } from 'react';

import { View as MotiView, useDynamicAnimation } from 'moti';
import { Platform, StyleSheet } from 'react-native';

import type { TransitionConfig } from 'moti';

type Props = {
  children?: React.ReactNode;
  /**
   * If `true`, the height will automatically animate to 0. Default: `false`.
   */
  hide?: boolean;
  /**
   * Custom transition for the outer `moti` View, which animates the `height`.
   *
   * See the [moti docs](https://moti.fyi/animations#customize-your-animation) for more info.
   *
   * Defaults to a `type: 'timing'` animation with a `delay` of 200. You can use this to customize that.
   */
  containerTransition?: TransitionConfig;
  onHeightDidAnimate?: (height: number) => void;
  /**
   * Defines where the expanded view will be anchored.
   *
   * Default: `top`
   *
   * This prop is untested, use with caution
   */
  enterFrom?: 'bottom' | 'top';
  initialHeight?: number;
} & React.ComponentProps<typeof MotiView>;

const styles = StyleSheet.create({
  autoBottom: {
    bottom: 'auto',
  },
  autoTop: {
    top: 'auto',
  },
  hidden: {
    overflow: 'hidden',
  },
  visible: {
    overflow: 'visible',
  },
});

function AnimateHeight({
  children,
  hide = false,
  style,
  animate = {},
  delay = Platform.select({ web: 250, default: 0 }),
  containerTransition = { type: 'timing', delay },
  transition = {
    type: 'timing',
    delay,
  },
  enterFrom = 'top',
  onHeightDidAnimate,
  initialHeight = 0,
  ...motiViewProps
}: Props) {
  const animation = useDynamicAnimation(() => ({
    height: hide ? 0 : initialHeight,
  }));
  const [measuredHeight, setHeight] = useState(initialHeight);

  let height = measuredHeight;

  if (hide) {
    height = 0;
  }

  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (hide) {
      animation.animateTo({
        height: 0,
      });
    } else if (animation.current?.height !== height) {
      animation.animateTo({
        height,
      });
    }
  }, [animation, height, hide]);

  const notVisible = !height || hide;

  return (
    <MotiView
      // animate={{ height }}
      state={animation}
      transition={containerTransition}
      onDidAnimate={
        onHeightDidAnimate &&
        ((key) => key === 'height' && onHeightDidAnimate?.(height))
      }
      // TODO shouldn't this always be hidden...?
      style={[height || hide ? styles.hidden : styles.visible, style]}
    >
      <MotiView
        {...motiViewProps}
        style={
          // notVisible &&
          [
            StyleSheet.absoluteFillObject,
            enterFrom === 'top' ? styles.autoBottom : styles.autoTop,
          ]
        }
        animate={{ ...animate, opacity: notVisible ? 0 : 1 }}
        transition={transition}
        onLayout={(next) => {
          if (mounted.current) {
            setHeight(next.nativeEvent.layout.height);
          }
        }}
      >
        {children}
      </MotiView>
    </MotiView>
  );
}

export default AnimateHeight;
