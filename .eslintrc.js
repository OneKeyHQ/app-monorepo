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
  'react/jsx-no-leaked-render': ['error', { 'validStrategies': ['ternary'] }],
  'react/no-unused-prop-types': 'off',
  'prefer-destructuring': 'off',
  'react/no-unstable-nested-components': 'warn',
  'react/jsx-key': 'error',
  'react/jsx-no-useless-fragment': 'off',
  'use-effect-no-deps/use-effect-no-deps': 'error',
  'react-hooks/exhaustive-deps': [
    'error',
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
  'ban/ban': [
    'error',
    {
      'name': ['*', 'toLocaleUpperCase'],
      'message': 'Prefer use toUpperCase',
    },
    {
      'name': ['*', 'toLocaleLowerCase'],
      'message': 'Prefer use toLowerCase',
    },
  ],
  // 'no-console': [isDev ? 'warn' : 'off'],
  'radix': 'error',
};
const restrictedImportsPatterns = [
  {
    allowTypeImports: true,
    group: ['@onekeyfe/hd-core'],
    message: 'using `const {} = await CoreSDKLoader()` instead',
  },
  {
    group: ['**/localDbInstance', '**/localDbInstance.native'],
    message:
      'import localDbInstance directly is not allowd, use localDb instead',
  },
  {
    group: ['**/v4localDbInstance.native'],
    message:
      'import v4localDbInstance.native directly is not allowd, use v4localDbInstance instead',
  },
  {
    group: [
      '**/v4ToV5Migration',
      'v4ToV5Migration/**',
      '**/v4ToV5Migration/**',
    ],
    message: 'import **/v4ToV5Migration/** not allowed ',
  },
  {
    group: ['**/v4localDBStoreNames.native'],
    message: 'import v4localDBStoreNames instead ',
  },
  //
];
const tsRules = {
  '@typescript-eslint/no-restricted-imports': [
    'error',
    {
      patterns: [...restrictedImportsPatterns],
    },
  ],
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
    'error',
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
  plugins: ['spellcheck', 'import-path', 'use-effect-no-deps', 'ban'],
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
    'packages/components/src/primitives/Icon/react/*',
  ],
  env: {
    browser: true,
    es6: true,
    webextensions: true,
    serviceworker: true,
    worker: true,
  },
  rules: {
    'import-path/parent-depth': ['error', 3],
    'import-path/forbidden': [
      'error',
      [
        {
          'match': '/index$',
          'message': 'Index on the end of path is redundant',
        },
      ],
    ],
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
          /Erc20/i,
          /Erc721/i,
          /Erc1155/i,
          /protobufjs/i,
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
    // specific rules for packages
    {
      files: [
        'packages/components/src/**/*.ts',
        'packages/components/src/**/*.tsx',
      ],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedImportsPatterns,
              {
                allowTypeImports: true,
                group: ['@onekeyhq/kit/*', '@onekeyhq/kit-bg/*'],
                message:
                  'Please avoid using @onekeyhq/kit and @onekeyhq/kit-bg in this folder',
              },
            ],
          },
        ],
      },
    },
    {
      files: [
        'packages/shared/src/**/*.ts',
        'packages/shared/src/**/*.tsx',
        'packages/core/src/**/*.ts',
        'packages/core/src/**/*.tsx',
      ],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedImportsPatterns,
              {
                allowTypeImports: true,
                group: [
                  '@onekeyhq/kit/*',
                  '@onekeyhq/kit-bg/*',
                  '@onekeyhq/components',
                  '@onekeyhq/components/*',
                ],
                message:
                  'Please avoid using @onekeyhq/kit and @onekeyhq/kit-bg and @onekeyhq/components in this folder',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['packages/kit-bg/src/**/*.ts', 'packages/kit-bg/src/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedImportsPatterns,
              {
                allowTypeImports: true,
                group: [
                  '@onekeyhq/kit/*',
                  '@onekeyhq/components',
                  '@onekeyhq/components/*',
                ],
                message:
                  'Please avoid using @onekeyhq/kit and @onekeyhq/components in this folder',
              },
            ],
          },
        ],
      },
    },
    {
      files: [
        'packages/kit-bg/src/**/*.ts',
        'packages/kit-bg/src/**/*.tsx',
        'packages/kit/src/**/*.ts',
        'packages/kit/src/**/*.tsx',
        'packages/core/src/**/*.ts',
        'packages/core/src/**/*.tsx',
      ],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedImportsPatterns,
              {
                allowTypeImports: true,
                group: ['tamagui'],
                message: 'Please avoid using tamagui in this folder',
              },
            ],
          },
        ],
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
