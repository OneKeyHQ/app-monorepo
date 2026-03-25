/**
 * Stub ESLint plugin so that `import-js/order` is recognized by ESLint.
 * The actual rule lives in oxlint (.oxlintrc.json).
 */
module.exports = {
  meta: { name: 'import-js' },
  rules: {
    order: {
      meta: { type: 'layout', schema: [] },
      create() {
        return {};
      },
    },
  },
};
