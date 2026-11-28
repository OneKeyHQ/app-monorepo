/* cspell:words oxlintrc callees reparent */

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

const requireTestid = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require testID prop on interactive components for QA automation',
    },
    schema: [
      {
        type: 'object',
        properties: {
          components: { type: 'array', items: { type: 'string' } },
        },
      },
    ],
  },
  create(context) {
    const defaultComponents = [
      'Button',
      'IconButton',
      'Input',
      'TextArea',
      'Select',
      'Switch',
      'Checkbox',
      'Radio',
      'Trigger',
      'InteractiveIcon',
    ];
    const components =
      (context.options[0] && context.options[0].components) ||
      defaultComponents;
    return {
      JSXOpeningElement(node) {
        const name =
          node.name.name || (node.name.object && node.name.object.name);
        if (!components.includes(name)) return;
        // Skip member expressions like Select.Item (only check Select itself)
        if (node.name.property) return;
        const hasTestID = node.attributes.some(
          (attr) =>
            attr.type === 'JSXAttribute' &&
            attr.name &&
            attr.name.name === 'testID',
        );
        if (!hasTestID) {
          context.report({
            node,
            message: `<${name}> should have a testID prop for QA automation.`,
          });
        }
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

const FABRIC_CONTAINERS = new Set([
  'View',
  'Stack',
  'XStack',
  'YStack',
  'ZStack',
]);

const NON_NATIVE_OR_TEST_FILE_RE =
  /\.(web|desktop|ext|test|spec|stories)\.[jt]sx?$/i;

function isPlatformEnvCondition(node) {
  if (!node || typeof node !== 'object') return false;
  if (
    node.type === 'MemberExpression' &&
    node.object &&
    node.object.type === 'Identifier' &&
    node.object.name === 'platformEnv'
  ) {
    return true;
  }
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    return isPlatformEnvCondition(node.argument);
  }
  if (node.type === 'LogicalExpression') {
    return (
      isPlatformEnvCondition(node.left) && isPlatformEnvCondition(node.right)
    );
  }
  return false;
}

const ANDROID_TRUE_PLATFORM_FLAGS = new Set([
  'isNative',
  'isNativeAndroid',
  'isAndroid',
]);

const ANDROID_FALSE_PLATFORM_FLAGS = new Set([
  'isWeb',
  'isDesktop',
  'isExtension',
  'isNativeIOS',
  'isIOS',
]);

// Evaluate a platformEnv boolean expression specifically on Android native.
// Returns true, false, or null if the expression is not purely static on Android.
function evalPlatformEnvOnAndroid(node) {
  if (!node || typeof node !== 'object') return null;
  if (
    node.type === 'MemberExpression' &&
    node.object &&
    node.object.type === 'Identifier' &&
    node.object.name === 'platformEnv' &&
    node.property &&
    node.property.type === 'Identifier'
  ) {
    if (ANDROID_TRUE_PLATFORM_FLAGS.has(node.property.name)) return true;
    if (ANDROID_FALSE_PLATFORM_FLAGS.has(node.property.name)) return false;
    return null;
  }
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    const inner = evalPlatformEnvOnAndroid(node.argument);
    return inner === null ? null : !inner;
  }
  if (node.type === 'LogicalExpression') {
    const left = evalPlatformEnvOnAndroid(node.left);
    const right = evalPlatformEnvOnAndroid(node.right);
    if (node.operator === '&&') {
      if (left === false || right === false) return false;
      if (left === true && right === true) return true;
      return null;
    }
    if (node.operator === '||') {
      if (left === true || right === true) return true;
      if (left === false && right === false) return false;
      return null;
    }
  }
  return null;
}

function isStaticOnAndroid(expr) {
  if (!expr || typeof expr !== 'object') return true;
  if (expr.type === 'Literal') return true;
  if (expr.type === 'Identifier' && expr.name === 'undefined') return true;
  if (expr.type === 'ConditionalExpression') {
    const androidTest = evalPlatformEnvOnAndroid(expr.test);
    if (androidTest === true) return isStaticOnAndroid(expr.consequent);
    if (androidTest === false) return isStaticOnAndroid(expr.alternate);
    if (isPlatformEnvCondition(expr.test)) {
      return (
        isStaticOnAndroid(expr.consequent) && isStaticOnAndroid(expr.alternate)
      );
    }
  }
  if (expr.type === 'LogicalExpression' && expr.operator === '&&') {
    if (evalPlatformEnvOnAndroid(expr.left) === false) return true;
  }
  return false;
}

function classifyLiteralString(expr) {
  if (!expr) return { kind: 'undef' };
  if (expr.type === 'Identifier' && expr.name === 'undefined') {
    return { kind: 'undef' };
  }
  if (expr.type === 'Literal') {
    if (expr.value === null) return { kind: 'undef' };
    if (typeof expr.value === 'string') {
      return { kind: 'str', value: expr.value };
    }
  }
  return { kind: 'unknown' };
}

function canFlipPointerEventsStackingContext(expr) {
  if (isStaticOnAndroid(expr)) return false;
  if (expr.type === 'ConditionalExpression') {
    const a = classifyLiteralString(expr.consequent);
    const b = classifyLiteralString(expr.alternate);
    if (a.kind !== 'unknown' && b.kind !== 'unknown') {
      const formsSC = (x) =>
        x.kind === 'str' && (x.value === 'none' || x.value === 'box-only');
      return formsSC(a) !== formsSC(b);
    }
  }
  return true;
}

function canFlipCursorStackingContext(expr) {
  if (isStaticOnAndroid(expr)) return false;
  if (expr.type === 'ConditionalExpression') {
    const a = classifyLiteralString(expr.consequent);
    const b = classifyLiteralString(expr.alternate);
    if (a.kind !== 'unknown' && b.kind !== 'unknown') {
      const formsSC = (x) =>
        x.kind === 'str' && x.value !== 'auto' && x.value !== '';
      return formsSC(a) !== formsSC(b);
    }
  }
  return true;
}

function getFabricContainerName(nameNode) {
  if (!nameNode) return null;
  if (nameNode.type === 'JSXIdentifier') {
    return FABRIC_CONTAINERS.has(nameNode.name) ? nameNode.name : null;
  }
  if (
    nameNode.type === 'JSXMemberExpression' &&
    nameNode.object &&
    nameNode.object.name === 'Animated' &&
    nameNode.property &&
    nameNode.property.name === 'View'
  ) {
    return 'Animated.View';
  }
  return null;
}

function hasPermanentStackingContext(attrs) {
  for (const attr of attrs) {
    const name = attr.name && attr.name.name;
    if (name === 'collapsable') {
      // Bare `collapsable` or `collapsable={true}` does not prevent flattening.
      const isLiteralTrue =
        attr.value &&
        attr.value.type === 'JSXExpressionContainer' &&
        attr.value.expression.type === 'Literal' &&
        attr.value.expression.value === true;
      if (attr.value && !isLiteralTrue) {
        return true;
      }
    }
    if (
      name === 'overflow' &&
      attr.value &&
      attr.value.type === 'Literal' &&
      attr.value.value === 'hidden'
    ) {
      return true;
    }
    if (name === 'accessible') {
      if (!attr.value) return true;
      if (
        attr.value.type === 'JSXExpressionContainer' &&
        attr.value.expression.type === 'Literal' &&
        attr.value.expression.value === true
      ) {
        return true;
      }
    }
    if (
      name === 'nativeID' &&
      attr.value &&
      attr.value.type === 'Literal' &&
      typeof attr.value.value === 'string' &&
      attr.value.value.length > 0
    ) {
      return true;
    }
    if (
      name === 'onPress' &&
      attr.value &&
      attr.value.type === 'JSXExpressionContainer' &&
      (attr.value.expression.type === 'ArrowFunctionExpression' ||
        attr.value.expression.type === 'FunctionExpression')
    ) {
      return true;
    }
  }
  return false;
}

const noUnsafeAndroidFabricFlattening = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Prevent Android Fabric view-flattening reparent crashes when dynamic pointerEvents or cursor toggles formsStackingContext without collapsable stabilization',
    },
    schema: [],
  },
  create(context) {
    const filename =
      context.filename || (context.getFilename && context.getFilename()) || '';
    if (NON_NATIVE_OR_TEST_FILE_RE.test(filename)) {
      return {};
    }

    return {
      JSXOpeningElement(node) {
        const containerName = getFabricContainerName(node.name);
        if (!containerName) return;

        const attrs = node.attributes.filter((a) => a.type === 'JSXAttribute');
        if (hasPermanentStackingContext(attrs)) return;

        const getAttr = (prop) =>
          attrs.find((a) => a.name && a.name.name === prop);

        const pointerEventsAttr = getAttr('pointerEvents');
        if (
          pointerEventsAttr &&
          pointerEventsAttr.value &&
          pointerEventsAttr.value.type === 'JSXExpressionContainer' &&
          canFlipPointerEventsStackingContext(
            pointerEventsAttr.value.expression,
          )
        ) {
          context.report({
            node: pointerEventsAttr,
            message:
              `Dynamic \`pointerEvents\` on <${containerName}> can toggle Android Fabric \`formsStackingContext\` ` +
              `and crash SurfaceMountingManager.addViewAt during transitions (REACT-NATIVE-3RP). ` +
              `Prefer \`disabled\` on child controls, or stabilize with ` +
              `\`collapsable={platformEnv.isNativeAndroid ? false : undefined}\` ` +
              `(and \`collapsableChildren\` if direct children also toggle \`focusable\`/\`onPress\`).`,
          });
        }

        const cursorAttr = getAttr('cursor');
        if (
          cursorAttr &&
          cursorAttr.value &&
          cursorAttr.value.type === 'JSXExpressionContainer' &&
          canFlipCursorStackingContext(cursorAttr.value.expression)
        ) {
          context.report({
            node: cursorAttr,
            message:
              `Dynamic \`cursor\` on <${containerName}> is unused on Android native but toggles Fabric \`formsStackingContext\` ` +
              `and can trigger view-flattening reparent crashes (REACT-NATIVE-3RP). ` +
              `Gate \`cursor\` to web/desktop or stabilize with \`collapsable={platformEnv.isNativeAndroid ? false : undefined}\`.`,
          });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: 'onekey' },
  rules: {
    'no-raw-error': noRawError,
    'require-testid': requireTestid,
    'no-app-locale-main-thread': noAppLocaleMainThread,
    'no-non-worklet-call-in-worklet': noNonWorkletCallInWorklet,
    'no-deprecated-buffer-constructor': noDeprecatedBufferConstructor,
    'no-unsafe-android-fabric-flattening': noUnsafeAndroidFabricFlattening,
  },
};

module.exports = plugin;
