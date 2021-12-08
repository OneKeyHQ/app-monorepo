const jsRules = {
  // eslint-disable-next-line global-require
  'prettier/prettier': ['error', require('./.prettierrc.js')],
  'no-unused-vars': 'off',
  'no-use-before-define': 'off',
  'import/no-extraneous-dependencies': 'off',
  'no-restricted-exports': 'off',
  'func-names': 'off',
  'class-methods-use-this': 'off',
  'import/extensions': 'off',
  'react/function-component-definition': 'off',
  'react/jsx-props-no-spreading': 'off',
};
const tsRules = {
  '@typescript-eslint/no-unused-vars': ['error'],
  '@typescript-eslint/no-use-before-define': ['error'],
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/ban-ts-comment': 'off',
};
module.exports = {
  env: {
    browser: true,
    es6: true,
    webextensions: true,
    serviceworker: true,
    worker: true,
  },
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
    // test files rules must be at LAST
    {
      files: ['test/**/*.js', 'test/**/*.ts', '**/*.test.ts'],
      // 'plugins': ['react', 'react-hooks', 'jest', 'import'],
      extends: ['plugin:jest/recommended'],
      env: {
        jest: true,
      },
      rules: {
        'jest/expect-expect': 'off',
        'jest/no-disabled-tests': 'off',
        'jest/no-conditional-expect': 'off',
        'jest/valid-title': 'off',
        'jest/no-interpolation-in-snapshots': 'off',
        'jest/no-export': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
      },
    },
  ],
};
