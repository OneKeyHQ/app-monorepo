const enabledTargets = [
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
    label: 'Electron renderer production webpack bundle，Desktop 渲染进程生产构建',
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
  'webpack/ext/mv3',
  'webpack/web-embed',
  'esbuild/desktop-main',
  'node/cli',
  'metro/mobile-main',
  'metro/mobile-bg',
  'build-system',
];

const disabledWorkspacePackageJsons = [
  'apps/ext/package.json',
  'apps/web-embed/package.json',
  'apps/cli/package.json',
  'apps/mobile/package.json',
];

const disabledRootScriptFragments = [
  'build-system',
  'cli',
  'desktop-main',
  'ext',
  'mobile',
  'web-embed',
];

module.exports = {
  disabledRootScriptFragments,
  disabledWorkspacePackageJsons,
  disabledTargetDirs,
  enabledTargets,
};
