// require('./development/lint/eslint-rule-force-async-bg-api'); // TODO not working
// require('./development/lint/eslint-rule-enforce-return-type');

const jsRules = {
  // '@typescript-eslint/explicit-function-return-type': ['error'],
  // eslint-disable-next-line global-require
  'prettier/prettier': ['error', require('./.prettierrc.js')],
  'no-unused-vars': 'off',
  'no-use-before-define': 'off',
  'no-shadow': 'off',
  'import/no-extraneous-dependencies': 'off',
  // 'force-async-bg-api': 'error', // TODO not working
  // 'enforce-return-type': 'error',
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
  // Handled by oxlint: react/jsx-key
  'react/jsx-key': 'off',
  'react/jsx-no-useless-fragment': 'off',
  // Handled by oxlint: react/rules-of-hooks
  'react-hooks/rules-of-hooks': 'off',
  // Handled by oxlint: react/exhaustive-deps
  'react-hooks/exhaustive-deps': 'off',
  'global-require': 'off',
  'import/no-unresolved': 'off', // tsc can check this
  'no-promise-executor-return': 'off',
  'default-param-last': 'off',
  // Handled by oxlint: import/no-cycle
  'import/no-cycle': 'off',
  'require-await': 'off',
  'no-void': 'off',
  // Handled by oxlint: suspicious category
  'block-scoped-var': 'off',
  'no-unneeded-ternary': 'off',
  'no-new': 'off',
  'no-unexpected-multiline': 'off',
  'no-useless-concat': 'off',
  'no-useless-constructor': 'off',
  'no-restricted-imports': 'off',
  // Handled by oxlint: import rules
  'import/no-empty-named-blocks': 'off',
  'import/no-absolute-path': 'off',
  'import/no-duplicates': 'off',
  'import/no-self-import': 'off',
  // Handled by oxlint: jest rules
  'jest/no-commented-out-tests': 'off',
  // Handled by oxlint: react rules
  'react/jsx-no-comment-textnodes': 'off',
  'react/jsx-no-script-url': 'off',
  'react/no-namespace': 'off',
  'react/style-prop-object': 'off',
  // Handled by oxlint: unicorn rules
  'unicorn/no-accessor-recursion': 'off',
  'unicorn/prefer-set-has': 'off',
  // NOTE: This rule stays in ESLint because oxlint jsPlugins is experimental
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
  // Handled by oxlint: radix
  'radix': 'off',
  // Handled by oxlint: unicorn/numeric-separators-style
  'unicorn/numeric-separators-style': 'off',
  // Handled by oxlint: unicorn/prefer-global-this
  'unicorn/prefer-global-this': 'off',
};
// const restrictedImportsPatterns = [
//   {
//     allowTypeImports: true,
//     group: ['@onekeyfe/hd-core'],
//     message: 'using `const {} = await CoreSDKLoader()` instead',
//   },
//   {
//     group: ['**/localDbInstance', '**/localDbInstance.native'],
//     message:
//       'import localDbInstance directly is not allowd, use localDb instead',
//   },
//   {
//     group: ['@onekeyhq/desktop/app/i18n'],
//     message: 'import ETranslations from "@onekeyhq/shared/src/locale" instead',
//   },
//   {
//     group: ['**/v4localDbInstance.native'],
//     message:
//       'import v4localDbInstance.native directly is not allowd, use v4localDbInstance instead',
//   },
//   {
//     group: [
//       '**/v4ToV5Migration',
//       'v4ToV5Migration/**',
//       '**/v4ToV5Migration/**',
//     ],
//     message: 'import **/v4ToV5Migration/** not allowed ',
//   },
//   {
//     group: ['**/v4localDBStoreNames.native'],
//     message: 'import v4localDBStoreNames instead ',
//   },
//   {
//     group: ['jotai'],
//     importNames: ['useAtom', 'useSetAtom', 'atom'],
//     message:
//       'Direct import of useAtom/useSetAtom from jotai is not allowed. Use contextAtom or globalAtom instead.',
//   },
//   //
// ];
const tsRules = {
  // Handled by oxlint: no-restricted-imports
  '@typescript-eslint/no-restricted-imports': 'off',
  '@typescript-eslint/default-param-last': 'off',
  // Handled by oxlint: typescript/consistent-type-imports
  '@typescript-eslint/consistent-type-imports': 'off',
  '@typescript-eslint/no-var-requires': 'off',
  // Handled by oxlint: no-unused-vars
  '@typescript-eslint/no-unused-vars': 'off',
  // Handled by oxlint: typescript/no-use-before-define
  '@typescript-eslint/no-use-before-define': 'off',
  // Handled by oxlint: typescript/no-shadow
  '@typescript-eslint/no-shadow': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/ban-ts-comment': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/require-await': 'off',
  // Handled by oxlint: typescript/no-floating-promises
  '@typescript-eslint/no-floating-promises': 'off',
  // Handled by oxlint: suspicious category
  '@typescript-eslint/no-confusing-non-null-assertion': 'off',
  '@typescript-eslint/no-extraneous-class': 'off',
  '@typescript-eslint/no-unnecessary-type-constraint': 'off',
  '@typescript-eslint/no-useless-constructor': 'off',
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
  // Handled by oxlint: sort-imports
  'sort-imports': 'off',
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
    '@cspell',
    'import-path',
    // 'use-effect-no-deps',
    'ban',
    'props-checker',
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
    // NOTE: These rules stay in ESLint because oxlint jsPlugins is experimental
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
    '@cspell/spellchecker': [
      'warn',
      {
        ignoreImports: true,
        ignoreImportProperties: true,
        checkJSXText: true,
        checkComments: true,
        checkStrings: false,
        checkIdentifiers: true,
        autoFix: false,
      },
    ],
    // NOTE: This rule stays in ESLint because oxlint jsPlugins is experimental
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
      extends: ['wesbos', 'plugin:oxlint/recommended'],
      rules: {
        ...jsRules,
      },
    },
    {
      files: ['*.ts', '*.tsx'],
      extends: ['wesbos/typescript', 'plugin:oxlint/recommended'],
      rules: {
        ...jsRules,
        ...tsRules,
      },
    },
    // specific rules for packages
    //
    // Note: Files are checked only once with the first matching configuration.
    // The order of these overrides matters - more specific patterns should come first.
    // {
    //   files: [
    //     'packages/components/src/**/*.ts',
    //     'packages/components/src/**/*.tsx',
    //   ],
    //   rules: {
    //     '@typescript-eslint/no-restricted-imports': [
    //       'error',
    //       {
    //         patterns: [
    //           ...restrictedImportsPatterns,
    //           {
    //             allowTypeImports: true,
    //             group: ['@onekeyhq/kit', '@onekeyhq/kit-bg'],
    //             message:
    //               'Please avoid using @onekeyhq/kit and @onekeyhq/kit-bg in this folder',
    //           },
    //         ],
    //       },
    //     ],
    //   },
    // },
    // {
    //   files: ['packages/shared/src/**/*.ts', 'packages/shared/src/**/*.tsx'],
    //   rules: {
    //     '@typescript-eslint/no-restricted-imports': [
    //       'error',
    //       {
    //         patterns: [
    //           ...restrictedImportsPatterns,
    //           {
    //             allowTypeImports: true,
    //             group: [
    //               '@onekeyhq/kit',
    //               '@onekeyhq/kit-bg',
    //               '@onekeyhq/components',
    //             ],
    //             message:
    //               'Please avoid using @onekeyhq/kit and @onekeyhq/kit-bg and @onekeyhq/components in this folder',
    //           },
    //         ],
    //       },
    //     ],
    //   },
    // },
    // {
    //   files: ['packages/kit-bg/src/**/*.ts', 'packages/kit-bg/src/**/*.tsx'],
    //   rules: {
    //     '@typescript-eslint/no-restricted-imports': [
    //       'error',
    //       {
    //         patterns: [
    //           ...restrictedImportsPatterns,
    //           {
    //             allowTypeImports: true,
    //             group: ['tamagui'],
    //             message: 'Please avoid using tamagui in this folder',
    //           },
    //           {
    //             allowTypeImports: true,
    //             group: ['@onekeyhq/kit', '@onekeyhq/components'],
    //             message:
    //               'Please avoid using @onekeyhq/kit and @onekeyhq/components in this folder',
    //           },
    //         ],
    //       },
    //     ],
    //   },
    // },
    // {
    //   files: ['packages/kit/src/**/*.ts', 'packages/kit/src/**/*.tsx'],
    //   rules: {
    //     '@typescript-eslint/no-restricted-imports': [
    //       'error',
    //       {
    //         patterns: [
    //           ...restrictedImportsPatterns,
    //           {
    //             allowTypeImports: true,
    //             group: ['tamagui'],
    //             message: 'Please avoid using tamagui in this folder',
    //           },
    //           {
    //             allowTypeImports: true,
    //             // TODO: upgrade eslint version to use regex pattern in no-restricted-imports rule
    //             // https://eslint.org/docs/latest/rules/no-restricted-imports
    //             group: [
    //               '@onekeyhq/kit-bg/src/connectors',
    //               '@onekeyhq/kit-bg/src/dbs',
    //               '@onekeyhq/kit-bg/src/endpoints',
    //               '@onekeyhq/kit-bg/src/migrations',
    //               '@onekeyhq/kit-bg/src/offscreens',
    //               '@onekeyhq/kit-bg/src/providers',
    //               '@onekeyhq/kit-bg/src/services',
    //               '@onekeyhq/kit-bg/src/vaults',
    //               '@onekeyhq/kit-bg/src/webembeds',
    //             ],
    //             message: 'Please avoid using @onekeyhq/kit-bg in this folder',
    //           },
    //         ],
    //       },
    //     ],
    //   },
    // },
    // {
    //   files: ['packages/core/src/**/*.ts', 'packages/core/src/**/*.tsx'],
    //   rules: {
    //     '@typescript-eslint/no-restricted-imports': [
    //       'error',
    //       {
    //         patterns: [
    //           ...restrictedImportsPatterns,
    //           {
    //             allowTypeImports: true,
    //             group: [
    //               'tamagui',
    //               '@onekeyhq/kit',
    //               '@onekeyhq/kit-bg',
    //               '@onekeyhq/components',
    //             ],
    //             message: 'Please avoid using tamagui in this folder',
    //           },
    //         ],
    //       },
    //     ],
    //   },
    // },
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
