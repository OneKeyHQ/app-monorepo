import type {
  IOverlayAnimation,
  IOverlayMotion,
  IOverlayMotionInput,
  IOverlayMotionPreset,
  IOverlayPresentation,
  IOverlayTransition,
} from './types';

export interface IResolvedOverlayTransition extends Omit<
  IOverlayTransition,
  'motion'
> {
  motion: IOverlayMotion;
}

export interface IResolvedOverlayAnimation {
  enter: IResolvedOverlayTransition;
  exit: IResolvedOverlayTransition;
  backdrop: { motion: IOverlayMotion };
}

/**
 * Defaults match today's visuals: Dialog center (scale 0.85 + fade, quick),
 * Tamagui Sheet (slide from bottom, quick), message toasts (slide from top,
 * 300ms quad), Popover floating content (scale 0.95 + fade, popoverQuick).
 */
export const DEFAULT_OVERLAY_ANIMATIONS: Record<
  IOverlayPresentation,
  { enter: IOverlayTransition; backdrop: IOverlayMotionPreset }
> = {
  sheet: {
    enter: { type: 'slide', edge: 'bottom', motion: 'quick' },
    backdrop: 'quick',
  },
  center: {
    enter: { type: 'scale', scale: 0.85, fade: true, motion: 'quick' },
    backdrop: 'quick',
  },
  toast: {
    enter: { type: 'slide', edge: 'top', fade: true, motion: 'toastSlide' },
    backdrop: 'quick',
  },
  fullscreen: {
    enter: { type: 'fade', motion: 'quick' },
    backdrop: 'quick',
  },
  anchored: {
    enter: {
      type: 'scale',
      scale: 0.95,
      fade: true,
      origin: 'anchor',
      motion: 'popoverQuick',
    },
    backdrop: 'popoverQuick',
  },
};

function resolveMotion(
  input: IOverlayMotionInput | undefined,
  fallback: IOverlayMotionInput,
  presets: Record<IOverlayMotionPreset, IOverlayMotion>,
): IOverlayMotion {
  const value = input ?? fallback;
  return typeof value === 'string' ? presets[value] : value;
}

function resolveTransition(
  transition: IOverlayTransition,
  fallbackMotion: IOverlayMotionInput,
  presets: Record<IOverlayMotionPreset, IOverlayMotion>,
): IResolvedOverlayTransition {
  return {
    ...transition,
    fade: transition.fade ?? transition.type === 'scale',
    motion: resolveMotion(transition.motion, fallbackMotion, presets),
  };
}

/** Fills presentation defaults and turns preset names into concrete curves. */
export function resolveOverlayAnimation(
  presentation: IOverlayPresentation,
  animation: IOverlayAnimation | undefined,
  presets: Record<IOverlayMotionPreset, IOverlayMotion>,
): IResolvedOverlayAnimation {
  const defaults = DEFAULT_OVERLAY_ANIMATIONS[presentation];
  const enterInput = animation?.enter ?? defaults.enter;
  const fallbackMotion = defaults.enter.motion ?? 'quick';
  const enter = resolveTransition(enterInput, fallbackMotion, presets);
  const exit = animation?.exit
    ? resolveTransition(animation.exit, fallbackMotion, presets)
    : enter;
  return {
    enter,
    exit,
    backdrop: {
      motion: resolveMotion(
        animation?.backdrop?.motion,
        defaults.backdrop,
        presets,
      ),
    },
  };
}
