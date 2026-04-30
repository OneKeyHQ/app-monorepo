/* cspell:words oxlintrc */

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

const plugin = {
  meta: { name: 'onekey' },
  rules: {
    'no-raw-error': noRawError,
    'no-app-locale-main-thread': noAppLocaleMainThread,
  },
};

module.exports = plugin;
