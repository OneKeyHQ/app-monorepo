import { Easing, FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

// Shared motion vocabulary for the device-setup cards.
//
// The onboarding's enter/exit transitions all use ease-out cubic — the
// web-animation rule that content entering or leaving the viewport eases out
// (an instant, responsive start that settles into place).
export const EASE_OUT_CUBIC = Easing.out(Easing.cubic);

// A sequenced ("mode=wait") opacity cross-fade: the old content fully fades OUT,
// then the new fades IN — never overlapping. The enter is delayed by exactly the
// exit duration, so the old reaches opacity 0 at the instant the new starts
// rising: a clean handoff with no muddy overlap and no lingering blank. Opacity
// only (the GPU-cheap transform/opacity rule); both respect reduced motion.
//
// Drives both the macro-phase swap (checking → stepper → ready) and the in-card
// body swap (the Setup card cycling choice / create / restore). Keep `exitMs`
// ~20–25% shorter than `enterMs` — exits read quicker than entrances.
export function makeSequencedFade({
  enterMs,
  exitMs,
}: {
  enterMs: number;
  exitMs: number;
}) {
  return {
    entering: FadeIn.duration(enterMs)
      .delay(exitMs)
      .easing(EASE_OUT_CUBIC)
      .reduceMotion(ReduceMotion.System),
    exiting: FadeOut.duration(exitMs)
      .easing(EASE_OUT_CUBIC)
      .reduceMotion(ReduceMotion.System),
  };
}
