import { RuleTester } from 'eslint';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require('../eslint-plugin-onekey');

const tester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('onekey/no-raw-error', () => {
  tester.run('no-raw-error', plugin.rules['no-raw-error'], {
    valid: [
      { code: `throw new OneKeyLocalError('boom');` },
      { code: `throw new OneKeyError('boom');` },
      { code: `const e = new Error('boom');` },
      { code: `const err = caught; throw err;` },
    ],
    invalid: [
      {
        code: `throw new Error('boom');`,
        errors: [{ message: /OneKeyLocalError or OneKeyError/ }],
      },
      {
        code: `function f() { throw new Error('x'); }`,
        errors: [{ message: /OneKeyLocalError or OneKeyError/ }],
      },
    ],
  });
});

describe('onekey/no-app-locale-main-thread', () => {
  tester.run(
    'no-app-locale-main-thread',
    plugin.rules['no-app-locale-main-thread'],
    {
      valid: [
        { code: `intl.formatMessage({ id: 'x' });` },
        { code: `useIntl().formatMessage({ id: 'x' });` },
        { code: `appLocale.intl;` },
        { code: `someOther.intl.formatMessage({ id: 'x' });` },
      ],
      invalid: [
        {
          code: `appLocale.intl.formatMessage({ id: 'x' });`,
          errors: [
            {
              message:
                /Main thread must not use appLocale\.intl\.formatMessage/,
            },
          ],
        },
        {
          code: `const s = appLocale.intl.formatMessage({ id: 'y' });`,
          errors: [
            {
              message:
                /Main thread must not use appLocale\.intl\.formatMessage/,
            },
          ],
        },
      ],
    },
  );
});

describe('onekey/no-non-worklet-call-in-worklet', () => {
  tester.run(
    'no-non-worklet-call-in-worklet',
    plugin.rules['no-non-worklet-call-in-worklet'],
    {
      valid: [
        // Inline arrow only calls a helper that has 'worklet' directive.
        {
          code: `
            function ok() { 'worklet'; return 1; }
            useAnimatedReaction(() => 1, () => { ok(); });
          `,
        },
        // runOnJS escape hatch is allowed inside the worklet body.
        {
          code: `
            function jsOnly() { return 1; }
            useAnimatedReaction(() => 1, () => { runOnJS(jsOnly)(); });
          `,
        },
        // Identifier passed to runOnUI but the target has the directive.
        {
          code: `
            function ok() { 'worklet'; return 1; }
            runOnUI(ok)();
          `,
        },
        // Object handler property points at a worklet-directive function.
        {
          code: `
            function onScroll() { 'worklet'; }
            useAnimatedScrollHandler({ onScroll });
          `,
        },
        // Identifier we can't resolve in this file — skip silently.
        {
          code: `
            useAnimatedReaction(() => 1, () => { unknownExternalHelper(); });
          `,
        },
        // Non-worklet hooks are out of scope.
        {
          code: `
            function notWorklet() { return 1; }
            useEffect(() => { notWorklet(); });
          `,
        },
        // Member-expression call must not collide with a module-scope helper
        // of the same name. obj.format() is unrelated to the local format().
        {
          code: `
            function format() { return 1; }
            useAnimatedReaction(() => 1, () => { obj.format(); });
          `,
        },
        // Component-local helper declared with 'worklet' directive — used
        // inside a worklet hook in the same component is fine.
        {
          code: `
            function MyComponent() {
              function localHelper() { 'worklet'; return 1; }
              useAnimatedStyle(() => ({ width: localHelper() }));
            }
          `,
        },
        // Shadowing: module-scope worklet helper, plus an unrelated
        // non-worklet local with the same name in another component. The
        // worklet hook in ComponentB resolves to the module-scope worklet
        // and must not be flagged. (Scope-based resolution required.)
        {
          code: `
            function helper() { 'worklet'; return 1; }
            function ComponentA() {
              function helper() { return 2; }
              doSomething(helper);
            }
            function ComponentB() {
              useAnimatedStyle(() => ({ width: helper() }));
            }
          `,
        },
      ],
      invalid: [
        // 1) Inline arrow body calls non-worklet helper.
        {
          code: `
            function badInline() { return 1; }
            useAnimatedReaction(() => 1, () => { badInline(); });
          `,
          errors: [
            {
              message:
                /Function 'badInline' is called from a Reanimated worklet \(useAnimatedReaction\)/,
            },
          ],
        },
        // 2) Object handler map — inline arrow property body calls non-worklet helper.
        {
          code: `
            function badObjInline() { return 2; }
            useAnimatedScrollHandler({ onScroll: () => { badObjInline(); } });
          `,
          errors: [
            {
              message:
                /Function 'badObjInline' is called from a Reanimated worklet \(useAnimatedScrollHandler\)/,
            },
          ],
        },
        // 3) Object handler map — shorthand identifier referencing a non-worklet helper.
        {
          code: `
            function badObjId() { return 3; }
            useAnimatedGestureHandler({ onStart: badObjId });
          `,
          errors: [
            {
              message:
                /Function 'badObjId' is passed to a Reanimated worklet hook \(useAnimatedGestureHandler\)/,
            },
          ],
        },
        // 4) Identifier passed directly to runOnUI.
        {
          code: `
            function badIdDirect() { return 4; }
            runOnUI(badIdDirect);
          `,
          errors: [
            {
              message:
                /Function 'badIdDirect' is passed to a Reanimated worklet hook \(runOnUI\)/,
            },
          ],
        },
        // 5) Object property is a function expression that calls a bad helper.
        {
          code: `
            function badInner() { return 5; }
            useAnimatedScrollHandler({
              onBeginDrag: function () { badInner(); },
            });
          `,
          errors: [
            {
              message:
                /Function 'badInner' is called from a Reanimated worklet \(useAnimatedScrollHandler\)/,
            },
          ],
        },
        // 6) Component-local helper without 'worklet' directive — most
        // common React pattern, must NOT slip through. (Regression guard
        // for module-scope-only indexing.)
        {
          code: `
            function MyComponent() {
              function localBad(y) { return y > 100; }
              useAnimatedReaction(() => 1, (v) => { localBad(v); });
            }
          `,
          errors: [
            {
              message:
                /Function 'localBad' is called from a Reanimated worklet \(useAnimatedReaction\)/,
            },
          ],
        },
        // 7) Helper declared inside a custom hook — same shape as (6) but
        // exercises function-variable nesting.
        {
          code: `
            function useThing() {
              const innerBad = () => 7;
              useAnimatedStyle(() => ({ width: innerBad() }));
            }
          `,
          errors: [
            {
              message:
                /Function 'innerBad' is called from a Reanimated worklet \(useAnimatedStyle\)/,
            },
          ],
        },
        // 8) Shadowing: module-scope worklet helper is shadowed by a local
        // non-worklet of the same name. The worklet hook resolves to the
        // local (closer scope), which lacks the directive → must flag.
        {
          code: `
            function helper() { 'worklet'; return 1; }
            function MyComponent() {
              function helper() { return 2; }
              useAnimatedStyle(() => ({ width: helper() }));
            }
          `,
          errors: [
            {
              message:
                /Function 'helper' is called from a Reanimated worklet \(useAnimatedStyle\)/,
            },
          ],
        },
      ],
    },
  );
});
