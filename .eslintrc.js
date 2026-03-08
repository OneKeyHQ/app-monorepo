/**
 * NOTICE: Linting has been migrated to oxlint
 *
 * - The oxc plugin can be enabled and eslint plugins should be disabled
 * - Due to incomplete oxc plugin functionality, this config file is kept temporarily
 *   for linting purposes only and will not be actively updated
 * - This file is maintained for backward compatibility during the transition period
 *
 * ⚠️ IMPORTANT FOR AI ASSISTANTS:
 * DO NOT reference lint rules from this file. Instead, read and follow the
 * configuration in .oxlintrc.json which contains the active linting rules. cspell:ignore oxlintrc
 */

// require('./development/lint/eslint-rule-force-async-bg-api'); // TODO not working
// require('./development/lint/eslint-rule-enforce-return-type');

const isDev = process.env.NODE_ENV !== 'production';
const jsRules = {
  // --- Rules from wesbos config (previously inherited via extends: ['wesbos']) ---
  'no-debugger': 'off',
  'no-alert': 'off',
  'no-await-in-loop': 'off',
  'no-console': 'off',
  'no-underscore-dangle': 'off',
  'consistent-return': 'off',
  'no-return-assign': ['error', 'except-parens'],
  'no-param-reassign': ['error', { props: false }],
  'react/react-in-jsx-scope': 'off',
  'react/require-default-props': 'off',
  'react/no-array-index-key': 'off',
  'react/forbid-prop-types': 'off',
  'react/no-unescaped-entities': 'off',
  'react/prefer-stateless-function': 'off',
  'react/display-name': 'warn',
  'react/prop-types': 'off',
  'react/jsx-filename-extension': [
    'warn',
    { extensions: ['.js', '.jsx', '.ts', '.tsx', '.mdx'] },
  ],
  'import/no-cycle': 'off',
  'import/prefer-default-export': 'off',
  // --- Project-specific rules ---
  // eslint-disable-next-line global-require
  'prettier/prettier': ['error', require('./.prettierrc.js')],
  'no-unused-vars': 'off',
  'no-use-before-define': 'off',
  'no-shadow': 'off',
  'import/no-extraneous-dependencies': 'off',
  // Disabled: handled by oxlint
  'no-unused-expressions': 'off',
  'no-restricted-exports': 'off',
  'func-names': 'off',
  'import/no-named-as-default-member': 'off',
  'class-methods-use-this': 'off',
  'import/extensions': 'off',
  'react/function-component-definition': 'off',
  'react/jsx-props-no-spreading': 'off',
  'react/jsx-no-leaked-render': ['error', { 'validStrategies': ['ternary'] }],
  'react/no-unused-prop-types': 'off',
  'arrow-body-style': 'off',
  'prefer-destructuring': 'off',
  'react/no-unstable-nested-components': 'warn',
  'react/jsx-key': 'error',
  'react/jsx-no-useless-fragment': 'off',
  'use-effect-no-deps/use-effect-no-deps': 'error',
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': [
    'error',
    {
      'additionalHooks':
        '(usePromiseResult|useAsyncCall|useUpdateEffect|useDeepCompareEffect)',
    },
  ],
  'global-require': 'off',
  'import/no-unresolved': 'off', // tsc can check this
  'no-promise-executor-return': 'off',
  'default-param-last': 'off',
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
    {
      'name': ['InteractionManager', 'runAfterInteractions'],
      'message':
        'Use timerUtils.setTimeoutPromised instead of InteractionManager.runAfterInteractions',
    },
  ],
  // 'no-console': [isDev ? 'warn' : 'off'],
  'radix': 'error',
  'unicorn/numeric-separators-style': 'error',
  'unicorn/prefer-global-this': 'error',
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
    group: ['@onekeyhq/desktop/app/i18n'],
    message: 'import ETranslations from "@onekeyhq/shared/src/locale" instead',
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
  {
    group: ['jotai'],
    importNames: ['useAtom', 'useSetAtom', 'atom'],
    message:
      'Direct import of useAtom/useSetAtom from jotai is not allowed. Use contextAtom or globalAtom instead.',
  },
  //
];
const tsRules = {
  // --- Rules from wesbos/typescript (previously inherited) ---
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-misused-promises': [
    'error',
    { checksVoidReturn: false },
  ],
  // Disabled: TS function overloads trigger false positives; oxlint handles this
  'no-redeclare': 'off',
  '@typescript-eslint/no-redeclare': 'off',
  'no-undef': 'off', // covered by typescript compiler
  // Renamed in @typescript-eslint v8 (from airbnb-typescript compat)
  '@typescript-eslint/lines-between-class-members': 'off',
  '@typescript-eslint/no-throw-literal': 'off',
  '@typescript-eslint/no-require-imports': 'off',
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
  '@typescript-eslint/no-unused-vars': [
    isDev ? 'warn' : 'error',
    {
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_',
      'caughtErrorsIgnorePattern': '^_',
      'ignoreRestSiblings': true,
    },
  ],
  '@typescript-eslint/no-use-before-define': ['error'],
  '@typescript-eslint/no-shadow': ['error'],
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/ban-ts-comment': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/require-await': 'off',
  // force awaited promise call, explicit add `void` if don't want await
  '@typescript-eslint/no-floating-promises': ['error'],
  // Disabled: handled by oxlint
  '@typescript-eslint/await-thenable': 'off',
  '@typescript-eslint/no-duplicate-enum-values': 'off',
  // Disabled: handled by oxlint
  'no-unused-expressions': 'off',
  '@typescript-eslint/no-unused-expressions': 'off',
  '@typescript-eslint/no-unsafe-enum-comparison': 'off',
  '@typescript-eslint/no-redundant-type-constituents': 'off',
  '@typescript-eslint/prefer-promise-reject-errors': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-base-to-string': 'off',
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
    {
      selector: 'ThrowStatement > NewExpression[callee.name="Error"]',
      message:
        'Direct use of "throw new Error" is not allowed. Use OneKeyLocalError or OneKeyError instead',
    },
  ],
};

const resolveExtensions = (platform) =>
  ['.ts', '.tsx', '.js', '.jsx'].map((ext) => `${platform}${ext}`);

module.exports = {
  plugins: [
    'import-path',
    'use-effect-no-deps',
    'ban',
    'unicorn',
    'props-checker',
    'prettier',
    'react',
    'react-hooks',
    'import',
  ],
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
    'packages/components/src/primitives/Icon/Icons.tsx',
    'packages/components/src/primitives/Icon/react/*',
    'packages/shared/src/modules3rdParty/stripe-v3/*',
    'packages/core/src/chains/xmr/sdkXmr/moneroCore/moneroCore.js',
    'packages/shared/src/locale/enum/translations.ts',
    'packages/shared/src/locale/localeJsonMap.ts',
    'packages/shared/src/locale/json/*',
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
    'props-checker/validator': [
      'error',
      {
        props: [
          {
            propName: 'onPress',
            components: [
              { component: 'Stack', dependOn: 'pressStyle' },
              { component: 'XStack', dependOn: 'pressStyle' },
              { component: 'YStack', dependOn: 'pressStyle' },
            ],
          },
          { propName: 'accessible', components: ['TextInput'] },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['*.js', '*.jsx', '*.text-js'],
      extends: ['airbnb', 'prettier'],
      rules: {
        ...jsRules,
      },
    },
    {
      files: ['*.ts', '*.tsx'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'airbnb-typescript',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'airbnb',
        'prettier',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
      },
      rules: {
        ...jsRules,
        ...tsRules,
      },
    },
    // specific rules for packages
    //
    // Note: Files are checked only once with the first matching configuration.
    // The order of these overrides matters - more specific patterns should come first.
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
                group: ['@onekeyhq/kit', '@onekeyhq/kit-bg'],
                message:
                  'Please avoid using @onekeyhq/kit and @onekeyhq/kit-bg in this folder',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['packages/shared/src/**/*.ts', 'packages/shared/src/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedImportsPatterns,
              {
                allowTypeImports: true,
                group: [
                  '@onekeyhq/kit',
                  '@onekeyhq/kit-bg',
                  '@onekeyhq/components',
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
                group: ['tamagui'],
                message: 'Please avoid using tamagui in this folder',
              },
              {
                allowTypeImports: true,
                group: ['@onekeyhq/kit', '@onekeyhq/components'],
                message:
                  'Please avoid using @onekeyhq/kit and @onekeyhq/components in this folder',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['packages/kit/src/**/*.ts', 'packages/kit/src/**/*.tsx'],
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
              {
                allowTypeImports: true,
                // TODO: upgrade eslint version to use regex pattern in no-restricted-imports rule
                // https://eslint.org/docs/latest/rules/no-restricted-imports
                group: [
                  '@onekeyhq/kit-bg/src/connectors',
                  '@onekeyhq/kit-bg/src/dbs',
                  '@onekeyhq/kit-bg/src/endpoints',
                  '@onekeyhq/kit-bg/src/migrations',
                  '@onekeyhq/kit-bg/src/offscreens',
                  '@onekeyhq/kit-bg/src/providers',
                  '@onekeyhq/kit-bg/src/services',
                  '@onekeyhq/kit-bg/src/vaults',
                  '@onekeyhq/kit-bg/src/webembeds',
                ],
                message: 'Please avoid using @onekeyhq/kit-bg in this folder',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['packages/core/src/**/*.ts', 'packages/core/src/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedImportsPatterns,
              {
                allowTypeImports: true,
                group: [
                  'tamagui',
                  '@onekeyhq/kit',
                  '@onekeyhq/kit-bg',
                  '@onekeyhq/components',
                ],
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
