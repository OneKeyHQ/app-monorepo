/**
 * Type marker for functions that contain a `'worklet';` directive and are
 * safe to call from a Reanimated UI-thread context (`useAnimatedReaction`,
 * `useAnimatedStyle`, `useDerivedValue`, `runOnUI`, etc.).
 *
 * Background:
 * Reanimated's babel plugin auto-worklets *inline* arrow / function
 * expressions passed to its hooks. It does NOT auto-worklet top-level named
 * function declarations or imported helpers. Calling such a helper from the
 * UI thread crashes the app with
 *   `C++ Exception: N8facebook3jsi7JSErrorE: Object is not a function`
 * (see iOS REACT-NATIVE-4FJ / Android REACT-NATIVE-3RG).
 *
 * Use `WorkletFn<F>` to annotate any helper that crosses into worklet
 * scope, especially across files. The branded type is purely a static /
 * review signal — the runtime body still MUST start with `'worklet';`. The
 * `onekey/no-non-worklet-call-in-worklet` lint rule enforces the directive
 * for same-file callers.
 *
 * @example
 *   const decide: WorkletFn<(x: number) => boolean> = (x) => {
 *     'worklet';
 *     return x > 0;
 *   };
 *
 *   useAnimatedReaction(
 *     () => sv.value,
 *     (cur) => {
 *       'worklet';
 *       runOnJS(setFlag)(decide(cur));
 *     },
 *   );
 */
declare const WORKLET_BRAND: unique symbol;

export type WorkletFn<F extends (...args: any[]) => any> = F & {
  readonly [WORKLET_BRAND]?: true;
};
