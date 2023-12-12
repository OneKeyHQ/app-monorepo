const isDev = process.env.NODE_ENV !== 'production';
const jsRules = {
  // eslint-disable-next-line global-require
  'prettier/prettier': ['error', require('./.prettierrc.js')],
  'no-unused-vars': 'off',
  'no-use-before-define': 'off',
  'no-shadow': 'off',
  'import/no-extraneous-dependencies': 'off',
  'no-restricted-exports': 'off',
  'func-names': 'off',
  'class-methods-use-this': 'off',
  'import/extensions': 'off',
  'react/function-component-definition': 'off',
  'react/jsx-props-no-spreading': 'off',
  'react/no-unused-prop-types': 'off',
  'react/no-unstable-nested-components': 'warn',
  'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
  'react-hooks/exhaustive-deps': [
    'warn',
    {
      'additionalHooks': '(usePromiseResult|useAsyncCall)',
    },
  ],
  'global-require': 'off',
  'import/no-unresolved': 'off', // tsc can check this
  'no-promise-executor-return': 'off',
  'default-param-last': 'off',
  'import/no-cycle': 'error',
  'require-await': 'off',
  'no-void': 'off',
  // 'no-console': [isDev ? 'warn' : 'off'],
};
const tsRules = {
  '@typescript-eslint/default-param-last': 'off',
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { disallowTypeAnnotations: false },
  ],
  '@typescript-eslint/no-var-requires': 'off',
  '@typescript-eslint/no-unused-vars': [isDev ? 'warn' : 'error'],
  '@typescript-eslint/no-use-before-define': ['error'],
  '@typescript-eslint/no-shadow': ['error'],
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/ban-ts-comment': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/require-await': 'off',
  // force awaited promise call, explicit add `void` if don't want await
  '@typescript-eslint/no-floating-promises': ['error'],
  '@typescript-eslint/naming-convention': [
    'warn',
    {
      'selector': ['interface', 'typeAlias'],
      'format': ['PascalCase'],
      'prefix': ['I'],
    },
    {
      'selector': ['enum'],
      'format': ['PascalCase'],
      'prefix': ['E'],
    },
  ],
  'sort-imports': [
    'error',
    {
      'ignoreMemberSort': false,
      'ignoreDeclarationSort': true,
    },
  ],
  'import/order': [
    'warn',
    {
      'groups': [
        'builtin',
        'internal',
        'index',
        'external',
        'parent',
        'sibling',
        'object',
        'type',
      ],
      'pathGroups': [
        {
          'pattern': 'react',
          'group': 'builtin',
          'position': 'before',
        },
        {
          'pattern': '@onekeyhq/**',
          'group': 'external',
          'position': 'after',
        },
      ],
      'alphabetize': {
        'order': 'asc',
        'caseInsensitive': true,
      },
      'newlines-between': 'always',
      'pathGroupsExcludedImportTypes': ['builtin'],
      'warnOnUnassignedImports': true,
    },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector:
        "ImportDeclaration[source.value='react'][specifiers.0.type='ImportDefaultSpecifier']",
      message: 'Default React import not allowed',
    },
  ],
};

const resolveExtensions = (platform) =>
  ['.ts', '.tsx', '.js', '.jsx'].map((ext) => `${platform}${ext}`);
module.exports = {
  plugins: ['spellcheck'],
  settings: {
    'import/extensions': [
      ...resolveExtensions('web'),
      ...resolveExtensions('desktop'),
      ...resolveExtensions('android'),
      ...resolveExtensions('ios'),
      ...resolveExtensions('native'),
      ...resolveExtensions('ext'),
      '.ts',
      '.tsx',
      '.mjs',
      '.cjs',
      '.js',
      '.jsx',
      '.json',
      '.d.ts',
    ],
  },
  ignorePatterns: [
    '*.wasm.bin',
    'apps/desktop/public/static/js-sdk*',
    'packages/components/src/primitives/Icon/*',
    'packages/kit/src/store',
    'packages/shared/src/engine',
    'packages/core/src/chains/ada',
    'packages/core/src/chains/algo',
    'packages/core/src/chains/apt',
    'packages/core/src/chains/bch',
    'packages/core/src/chains/btc',
    'packages/core/src/chains/cfx',
    'packages/core/src/chains/cosmos',
    'packages/core/src/chains/doge',
    'packages/core/src/chains/dot',
    'packages/core/src/chains/fil',
    'packages/core/src/chains/kaspa',
    'packages/core/src/chains/ltc',
    'packages/core/src/chains/near',
    'packages/core/src/chains/nexa',
    'packages/core/src/chains/sol',
    'packages/core/src/chains/stc',
    'packages/core/src/chains/sui',
    'packages/core/src/chains/tron',
    'packages/core/src/chains/xmr',
    'packages/core/src/chains/xrp',
  ],
  env: {
    browser: true,
    es6: true,
    webextensions: true,
    serviceworker: true,
    worker: true,
  },
  rules: {
    'spellcheck/spell-checker': [
      1,
      {
        'comments': true,
        'strings': false,
        'identifiers': true,
        'lang': 'en_US',
        'skipWords': require('./development/spellCheckerSkipWords.js'),
        'skipWordIfMatch': [
          /(\w|\d){50,}/i, // length>50
          /bip32/i,
          /pbkdf2/i,
          /Secp256k1/i,
          /googleapis/i,
        ],
        'skipIfMatch': ['http://[^s]*'],
        'minLength': 3,
      },
    ],
  },
  overrides: [
    {
      files: ['*.js', '*.jsx', '*.text-js'],
      extends: ['wesbos'],
      rules: {
        ...jsRules,
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
