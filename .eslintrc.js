const jsRules = {
  // eslint-disable-next-line global-require
  'prettier/prettier': ['error', require('./.prettierrc.js')],
  'no-unused-vars': 'warn',
  'import/no-extraneous-dependencies': 'off',
  'no-restricted-exports': 'off',
  'func-names': 'off',
  'class-methods-use-this': 'off',
  'import/extensions': 'off',
  'react/function-component-definition': 'off',
  'react/jsx-props-no-spreading': 'off',
  'no-use-before-define': 'off',
};
const tsRules = {
  '@typescript-eslint/no-use-before-define': ['error'],
  '@typescript-eslint/ban-ts-comment': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'warn',
  '@typescript-eslint/no-unsafe-member-access': 'warn',
  '@typescript-eslint/no-unsafe-call': 'warn',
  '@typescript-eslint/no-unsafe-return': 'warn',
  '@typescript-eslint/explicit-module-boundary-types': 'warn',
};
module.exports = {
  overrides: [
    {
      files: ['*.js', '*.jsx', '*.text-js'],
      extends: ['wesbos'],
      rules: {
        ...jsRules,
        // ...tsRules,
      },
    },
    {
      files: ['*.ts', '*.tsx'],
      extends: ['wesbos/typescript'],
      rules: {
        ...jsRules,
        ...tsRules,
      },
    },
  ],
};
