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

const plugin = {
  meta: { name: 'onekey' },
  rules: {
    'no-raw-error': noRawError,
    'require-testid': requireTestid,
  },
};

module.exports = plugin;
