/* cspell:words oxlintrc callees */

/**
 * Custom oxlint JS plugin for OneKey-specific lint rules.
 *
 * Usage in .oxlintrc.json:
 *   "jsPlugins": ["./development/plugins/eslint-plugin-onekey.js"]
 *   "rules": { "onekey/no-raw-error": "error" }
 */

const noRawError = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow throw new Error(), use OneKeyLocalError or OneKeyError instead',
    },
    schema: [],
  },
  create(context) {
    return {
      'ThrowStatement > NewExpression[callee.name="Error"]'(node) {
        context.report({
          node,
          message:
            'Direct use of "throw new Error" is not allowed. Use OneKeyLocalError or OneKeyError instead.',
        });
      },
    };
  },
};

const noAppLocaleMainThread = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'appLocale.intl is bg-thread only. Main thread should use useIntl() for reactivity.',
    },
    schema: [],
  },
  create(context) {
    return {
      "MemberExpression[object.type='MemberExpression'][object.object.name='appLocale'][object.property.name='intl'][property.name='formatMessage']"(
        node,
      ) {
        context.report({
          node,
          message:
            'Main thread must not use appLocale.intl.formatMessage — it is not reactive and falls back to the raw key when called at module top-level. Use useIntl().formatMessage in components, or pass intl as a parameter from the caller.',
        });
      },
    };
  },
};

// Reanimated hooks whose function arguments execute on the UI thread.
const WORKLET_HOOKS = new Set([
  'useAnimatedReaction',
  'useAnimatedStyle',
  'useDerivedValue',
  'useAnimatedScrollHandler',
  'useAnimatedGestureHandler',
  'useFrameCallback',
  'useAnimatedProps',
  'runOnUI',
]);

// Calls that are safe inside a worklet body: Reanimated builtins or escape
// hatches that explicitly cross threads.
const WORKLET_SAFE_CALLEES = new Set([
  'runOnJS',
  'runOnUI',
  'scrollTo',
  'measure',
  'cancelAnimation',
  'withTiming',
  'withSpring',
  'withDecay',
  'withSequence',
  'withRepeat',
  'withDelay',
  'interpolate',
  'interpolateColor',
]);

function calleeName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') return node.property?.name ?? null;
  return null;
}

function hasWorkletDirective(fn) {
  const body = fn?.body;
  if (!body || body.type !== 'BlockStatement') return false;
  const first = body.body[0];
  return (
    first?.type === 'ExpressionStatement' &&
    first.expression?.type === 'Literal' &&
    first.expression.value === 'worklet'
  );
}

const noNonWorkletCallInWorklet = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Functions called from a Reanimated worklet hook (useAnimatedReaction / useAnimatedStyle / runOnUI / ...) must contain a 'worklet'; directive. Reanimated's babel plugin does not auto-worklet top-level named declarations, and a missing directive crashes the UI thread with C++ \"Object is not a function\".",
    },
    schema: [],
  },
  create(context) {
    const SKIP_AST_KEYS = new Set(['parent', 'loc', 'range', 'start', 'end']);

    function isFunctionLikeNode(n) {
      return (
        n.type === 'FunctionDeclaration' ||
        n.type === 'FunctionExpression' ||
        n.type === 'ArrowFunctionExpression'
      );
    }

    function pushAstChildren(node, stack) {
      for (const k of Object.keys(node)) {
        if (!SKIP_AST_KEYS.has(k)) {
          const v = node[k];
          if (Array.isArray(v)) {
            for (const item of v) if (item) stack.push(item);
          } else if (v && typeof v === 'object' && v.type) {
            stack.push(v);
          }
        }
      }
    }

    function getScope(node) {
      if (context.sourceCode?.getScope) {
        return context.sourceCode.getScope(node);
      }
      return context.getScope();
    }

    // Walk the lexical scope chain to resolve `name` to its declaration.
    // Returns:
    //   true       — function definition with 'worklet'; directive
    //   false      — function definition without the directive (BAD)
    //   undefined  — unresolved (import / global / param / non-function var)
    function resolveFnDirective(name, scope) {
      let s = scope;
      while (s) {
        const v = s.set?.get?.(name);
        if (v) {
          const def = v.defs?.[0];
          if (!def) return undefined;
          if (def.type === 'FunctionName') {
            return hasWorkletDirective(def.node);
          }
          if (def.type === 'Variable') {
            const init = def.node?.init;
            if (
              init &&
              (init.type === 'FunctionExpression' ||
                init.type === 'ArrowFunctionExpression')
            ) {
              return hasWorkletDirective(init);
            }
          }
          return undefined;
        }
        s = s.upper;
      }
      return undefined;
    }

    function reportBadCall(callNode, hookName) {
      // Only bare Identifier callees can collide with a same-named helper.
      // For MemberExpression (obj.foo()) the receiver is independent.
      if (callNode.callee?.type !== 'Identifier') return;
      const name = callNode.callee.name;
      if (!name || WORKLET_SAFE_CALLEES.has(name)) return;
      if (resolveFnDirective(name, getScope(callNode.callee)) === false) {
        context.report({
          node: callNode.callee,
          message:
            `Function '${name}' is called from a Reanimated worklet (${hookName}) ` +
            `but its declaration lacks a "'worklet';" directive. ` +
            `Add the directive to the function body, inline the logic, ` +
            `or wrap the call with runOnJS(). Otherwise the UI thread ` +
            `will crash with "Object is not a function".`,
        });
      }
    }

    function reportBadIdentifierArg(idNode, hookName) {
      const name = idNode?.name;
      if (!name || WORKLET_SAFE_CALLEES.has(name)) return;
      if (resolveFnDirective(name, getScope(idNode)) === false) {
        context.report({
          node: idNode,
          message:
            `Function '${name}' is passed to a Reanimated worklet hook (${hookName}) ` +
            `but its declaration lacks a "'worklet';" directive. ` +
            `Add the directive to the function body, inline the logic, ` +
            `or wrap the call with runOnJS(). Otherwise the UI thread ` +
            `will crash with "Object is not a function".`,
        });
      }
    }

    function walkBodyForBadCalls(fnNode, hookName) {
      const body = fnNode.body;
      const stack = body.type === 'BlockStatement' ? [...body.body] : [body];
      while (stack.length) {
        const cur = stack.pop();
        // Don't descend into nested functions — they own their own context
        // (an inline arrow inside the worklet hook is processed automatically
        // by Reanimated's babel plugin).
        if (cur && typeof cur === 'object' && !isFunctionLikeNode(cur)) {
          if (cur.type === 'CallExpression') {
            reportBadCall(cur, hookName);
          }
          pushAstChildren(cur, stack);
        }
      }
    }

    // Normalize a hook argument into something we can inspect:
    // - inline function/arrow → walk its body
    // - identifier → resolve via scope and report if it lacks 'worklet'
    // - object handler map (useAnimatedScrollHandler / useAnimatedGestureHandler)
    //   → recurse into each property value
    function inspectWorkletArg(arg, hookName) {
      if (!arg || typeof arg !== 'object') return;
      if (isFunctionLikeNode(arg)) {
        walkBodyForBadCalls(arg, hookName);
        return;
      }
      if (arg.type === 'Identifier') {
        reportBadIdentifierArg(arg, hookName);
        return;
      }
      if (arg.type === 'ObjectExpression') {
        for (const prop of arg.properties) {
          if (prop.type === 'Property') {
            inspectWorkletArg(prop.value, hookName);
          }
        }
      }
    }

    return {
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (!name || !WORKLET_HOOKS.has(name)) return;
        for (const arg of node.arguments) {
          inspectWorkletArg(arg, name);
        }
      },
    };
  },
};

const noDeprecatedBufferConstructor = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow deprecated Buffer constructor calls. Use Buffer.from, Buffer.alloc, or Buffer.allocUnsafe explicitly.',
    },
    schema: [],
  },
  create(context) {
    function reportDeprecatedConstructor(node) {
      context.report({
        node,
        message:
          'Do not use the deprecated Buffer constructor. Use Buffer.from(...), Buffer.alloc(...), or Buffer.allocUnsafe(...) explicitly.',
      });
    }

    function reportInvalidNewBufferApi(node) {
      context.report({
        node,
        message:
          'Do not use new with Buffer APIs. Call Buffer.from(...), Buffer.alloc(...), or Buffer.allocUnsafe(...) directly.',
      });
    }

    return {
      'CallExpression[callee.name="Buffer"]'(node) {
        reportDeprecatedConstructor(node);
      },
      'NewExpression[callee.name="Buffer"]'(node) {
        reportDeprecatedConstructor(node);
      },
      "NewExpression[callee.type='MemberExpression'][callee.object.name='Buffer']"(
        node,
      ) {
        reportInvalidNewBufferApi(node);
      },
    };
  },
};

const plugin = {
  meta: { name: 'onekey' },
  rules: {
    'no-raw-error': noRawError,
    'no-app-locale-main-thread': noAppLocaleMainThread,
    'no-non-worklet-call-in-worklet': noNonWorkletCallInWorklet,
    'no-deprecated-buffer-constructor': noDeprecatedBufferConstructor,
  },
};

module.exports = plugin;
