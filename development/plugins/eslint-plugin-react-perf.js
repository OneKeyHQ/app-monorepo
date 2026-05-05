/**
 * Stub ESLint plugin so that `react-perf/*` disable comments are recognized
 * by ESLint. The actual rules live in oxlint (.oxlintrc.json).
 */
const noop = {
  meta: { type: 'suggestion', schema: [] },
  create() {
    return {};
  },
};

module.exports = {
  meta: { name: 'react-perf' },
  rules: {
    'jsx-no-new-function-as-prop': noop,
    'jsx-no-new-object-as-prop': noop,
    'jsx-no-new-array-as-prop': noop,
    'jsx-no-jsx-as-prop': noop,
  },
};
