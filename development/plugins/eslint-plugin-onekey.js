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

const plugin = {
  meta: { name: 'onekey' },
  rules: {
    'no-raw-error': noRawError,
  },
};

module.exports = plugin;
