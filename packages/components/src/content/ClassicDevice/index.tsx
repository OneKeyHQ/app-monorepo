import { useMemo } from 'react';

import { useSharedValue } from 'react-native-reanimated';

import { useSceneScreen } from '../deviceSceneHost';

import { ClassicPressContext } from './animation';
import { SCENES } from './scenes';
import { ClassicDeviceShell } from './shell';

import type { IClassicDeviceAnimation } from './animation';
import type { IClassicDeviceScene } from './scenes';
import type { IClassicDeviceShellProps } from './shell';

export type { IClassicDeviceScene } from './scenes';
export type { IClassicDeviceAnimation } from './animation';

/**
 * Code-drawn OneKey Classic device. Reached through ../HardwareDevice, which
 * is what call sites use; this layer is where the Classic's own scenes and
 * screen live.
 *
 *   <ClassicDevice animation="connecting" />       the OneKey mark
 *   <ClassicDevice animation="enterPin" />         the entry row loop
 *   <ClassicDevice animation="enterPassphrase" />
 *   <ClassicDevice animation="confirm" />          the light sweep
 *   <ClassicDevice />                              static shell, screen dark
 *
 * Scenes run on the shared presence machinery (../deviceSceneHost), the
 * same way the Pro's and the Slate's do: content renders in as the whole of
 * an entry, stays lit while the scene is on, and a scene change plays the
 * lit-to-lit handover (callers sequence anything else after SCREEN_SWAP_MS,
 * see ../deviceScene). The panel's faint glow rides the same opacity, so
 * "lighting up" is nothing but content rendering in. The shell chrome (the
 * noise, the blurs, the four keys) mounts once here; a scene change only
 * swaps the screen slot's content, and scenes reach the OK key through the
 * per-instance press drive (./animation). `animation` also accepts a custom
 * IClassicDeviceAnimation contract paired with your own `screenContent` -
 * the way live content would go on the 256x128 OLED, which is the whole
 * point of drawing the device in code rather than shipping a Lottie.
 */
export interface IClassicDeviceProps extends Omit<
  IClassicDeviceShellProps,
  'animation'
> {
  /**
   * A built-in scene name, or a custom animation contract. With a scene name
   * the scene supplies the screen, so `screenContent` is ignored.
   */
  animation?: IClassicDeviceScene | IClassicDeviceAnimation;
}

export function ClassicDevice({
  width,
  animation,
  screenContent,
}: IClassicDeviceProps) {
  const target = typeof animation === 'string' ? animation : undefined;
  const {
    displayed,
    slot,
    animation: sceneAnimation,
  } = useSceneScreen(target, SCENES);
  const okPress = useSharedValue(0);
  const pressDrive = useMemo(() => ({ ok: okPress }), [okPress]);
  const deviceAnimation: IClassicDeviceAnimation = useMemo(
    () => ({ screenContent: sceneAnimation.screenContent, press: pressDrive }),
    [pressDrive, sceneAnimation],
  );
  if (displayed) {
    return (
      <ClassicPressContext.Provider value={pressDrive}>
        <ClassicDeviceShell
          width={width}
          animation={deviceAnimation}
          screenContent={slot}
        />
      </ClassicPressContext.Provider>
    );
  }
  // Anything else counts as dark: the bare shell is dark, and whether a
  // custom contract lights the glass is its caller's business.
  return (
    <ClassicDeviceShell
      width={width}
      animation={typeof animation === 'string' ? undefined : animation}
      screenContent={typeof animation === 'string' ? undefined : screenContent}
    />
  );
}
