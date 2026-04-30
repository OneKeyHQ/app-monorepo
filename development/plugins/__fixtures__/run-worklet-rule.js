/* eslint-disable */
// Quick verification harness for the `no-non-worklet-call-in-worklet` rule.
// Not part of CI — run manually with `node development/plugins/__fixtures__/run-worklet-rule.js`.

const { RuleTester } = require('eslint');
const plugin = require('../eslint-plugin-onekey');

const rule = plugin.rules['no-non-worklet-call-in-worklet'];

const tester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('onekey/no-non-worklet-call-in-worklet', rule, {
  valid: [
    // Inline arrow body only calls a helper that has 'worklet' directive.
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
    // Identifier we can't resolve in this file (imported, hook param, etc.) — skip silently.
    {
      code: `
        useAnimatedReaction(() => 1, () => { unknownExternalHelper(); });
      `,
    },
  ],
  invalid: [
    // 1) Existing case — inline arrow calls non-worklet helper.
    {
      code: `
        function badInline() { return 1; }
        useAnimatedReaction(() => 1, () => { badInline(); });
      `,
      errors: [{ message: /badInline.*useAnimatedReaction/ }],
    },
    // 2) Object handler map — inline arrow property body calls non-worklet helper.
    {
      code: `
        function badObjInline() { return 2; }
        useAnimatedScrollHandler({ onScroll: () => { badObjInline(); } });
      `,
      errors: [{ message: /badObjInline.*useAnimatedScrollHandler/ }],
    },
    // 3) Object handler map — shorthand identifier referencing a non-worklet helper.
    {
      code: `
        function badObjId() { return 3; }
        useAnimatedGestureHandler({ onStart: badObjId });
      `,
      errors: [{ message: /badObjId.*useAnimatedGestureHandler/ }],
    },
    // 4) Identifier passed directly to runOnUI.
    {
      code: `
        function badIdDirect() { return 4; }
        runOnUI(badIdDirect);
      `,
      errors: [{ message: /badIdDirect.*runOnUI/ }],
    },
    // 5) Mixed — object property is a function expression that calls a bad helper.
    {
      code: `
        function badInner() { return 5; }
        useAnimatedScrollHandler({
          onBeginDrag: function () { badInner(); },
        });
      `,
      errors: [{ message: /badInner.*useAnimatedScrollHandler/ }],
    },
  ],
});

console.log('OK: all worklet-rule cases pass.');
