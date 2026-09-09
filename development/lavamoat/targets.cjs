// cspell:ignore Jsons lavamoat

const enabledTargets = [
  {
    id: 'webpack/cli',
    label: 'CLI Node runtime',
    policy: 'webpack/cli/policy.json',
    override: 'webpack/cli/policy-override.json',
    scriptSuffix: 'cli',
    workspacePackageJson: 'apps/cli/package.json',
    workspacePolicyScript: 'lavamoat:policy',
    workspaceBuildScript: 'build:lavamoat',
  },
  ...['main', 'preload'].map((context) => ({
    id: `webpack/desktop-${context}`,
    label: `Electron ${context}`,
    policy: `webpack/desktop-${context}/policy.json`,
    override: `webpack/desktop-${context}/policy-override.json`,
    scriptSuffix: `desktop-${context}`,
    workspacePackageJson: 'apps/desktop/package.json',
    workspacePolicyScript: `lavamoat:policy:${context}`,
    workspaceBuildScript: `build:${context}:lavamoat`,
  })),
  ...['index', 'enum', 'windowsHello', 'checkBiometricAuthChanged'].map(
    (entry) => ({
      id: `webpack/desktop-services/${entry}`,
      label: `Electron service ${entry}`,
      policy: `webpack/desktop-services/${entry}/policy.json`,
      override: `webpack/desktop-services/${entry}/policy-override.json`,
      scriptSuffix: `desktop-services-${entry}`,
      workspacePackageJson: 'apps/desktop/package.json',
      workspacePolicyScript: `lavamoat:policy:service:${entry}`,
      workspaceBuildScript: `build:service:${entry}:lavamoat`,
    }),
  ),
  {
    id: 'node/build-tools',
    label: 'CLI esbuild source runtime',
    policy: 'node/build-tools/policy.json',
    override: 'node/build-tools/policy-override.json',
    scriptSuffix: 'node-build',
    workspacePackageJson: 'package.json',
    workspacePolicyScript: 'lavamoat:policy:node-build:raw',
    workspaceBuildScript: 'lavamoat:build:node-build:raw',
  },
  ...['pages', 'background', 'content-script'].map((context) => ({
    id: `webpack/ext/mv3/${context}`,
    label: `MV3 extension ${context}`,
    policy: `webpack/ext/mv3/${context}/policy.json`,
    override: `webpack/ext/mv3/${context}/policy-override.json`,
    scriptSuffix: `ext-${context}`,
    workspacePackageJson: 'apps/ext/package.json',
    workspacePolicyScript: `lavamoat:policy:${context}`,
    workspaceBuildScript: `build:lavamoat:${context}`,
    workspaceDependencies: [
      '@onekeyhq/components',
      '@onekeyhq/core',
      '@onekeyhq/kit',
      '@onekeyhq/kit-bg',
      '@onekeyhq/qr-wallet-sdk',
      '@onekeyhq/shared',
    ],
  })),
  {
    id: 'webpack/web-embed',
    label: 'Embedded WebView production webpack bundle',
    policy: 'webpack/web-embed/policy.json',
    override: 'webpack/web-embed/policy-override.json',
    scriptSuffix: 'web-embed',
    workspacePackageJson: 'apps/web-embed/package.json',
    workspacePolicyScript: 'lavamoat:policy',
    workspaceBuildScript: 'build:lavamoat',
    workspaceDependencies: [
      '@onekeyhq/components',
      '@onekeyhq/core',
      '@onekeyhq/kit',
      '@onekeyhq/kit-bg',
      '@onekeyhq/qr-wallet-sdk',
      '@onekeyhq/shared',
    ],
  },
  {
    id: 'webpack/web',
    label: 'Web production webpack bundle，apps/web 生产构建',
    policy: 'webpack/web/policy.json',
    override: 'webpack/web/policy-override.json',
    scriptSuffix: 'web',
    workspacePackageJson: 'apps/web/package.json',
    workspacePolicyScript: 'lavamoat:policy',
    workspaceBuildScript: 'build:lavamoat',
    workspaceDependencies: [
      '@onekeyhq/components',
      '@onekeyhq/core',
      '@onekeyhq/kit',
      '@onekeyhq/kit-bg',
      '@onekeyhq/qr-wallet-sdk',
      '@onekeyhq/shared',
    ],
  },
  {
    id: 'webpack/desktop-renderer',
    label:
      'Electron renderer production webpack bundle，Desktop 渲染进程生产构建',
    policy: 'webpack/desktop-renderer/policy.json',
    override: 'webpack/desktop-renderer/policy-override.json',
    scriptSuffix: 'desktop-renderer',
    workspacePackageJson: 'apps/desktop/package.json',
    workspacePolicyScript: 'lavamoat:policy:renderer',
    workspaceBuildScript: 'build:renderer:lavamoat',
    workspaceDependencies: [
      '@onekeyhq/components',
      '@onekeyhq/core',
      '@onekeyhq/kit',
      '@onekeyhq/kit-bg',
      '@onekeyhq/qr-wallet-sdk',
      '@onekeyhq/shared',
    ],
  },
];

const disabledTargetDirs = [
  'webpack/ext/mv2',
  'metro/mobile-main',
  'metro/mobile-bg',
];

const disabledWorkspacePackageJsons = ['apps/mobile/package.json'];

const disabledRootScriptFragments = ['mobile'];

module.exports = {
  disabledRootScriptFragments,
  disabledWorkspacePackageJsons,
  disabledTargetDirs,
  enabledTargets,
};
