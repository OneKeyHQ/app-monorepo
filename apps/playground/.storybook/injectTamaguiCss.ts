/* oxlint-disable import-js/order -- evaluation order is load-bearing here:
   the Buffer / process / global shims must land before the tamagui.config
   import below runs createTamagui, whose transitive @onekeyhq/shared deps read
   those globals at module-eval time. */
import './polyfills';

// Same singleton the ConfigProvider requires at runtime.
import tamaguiConfig from '@onekeyhq/components/tamagui.config';

// The app's tamagui.config is created with `disableSSR: true` +
// `themeClassNameOnRoot: false`, so Tamagui expects a compiler/SSR step to have
// emitted the theme variable blocks (`.t_light { --bgApp: … }`, token + font
// vars). A pure-runtime Storybook has no such step, so those never land and
// every `var(--…)` resolves to transparent/0/fallback. Inject the full CSS once
// here — the documented Tamagui "no compiler" path — so themes, tokens and fonts
// are defined before any story renders.
if (
  typeof document !== 'undefined' &&
  !document.getElementById('tamagui-runtime-css')
) {
  const styleEl = document.createElement('style');
  styleEl.id = 'tamagui-runtime-css';
  styleEl.appendChild(
    document.createTextNode(
      (tamaguiConfig as unknown as { getCSS: () => string }).getCSS(),
    ),
  );
  document.head.appendChild(styleEl);
}
