import { rspack } from '@rspack/core';

import type { Compiler, RspackPluginInstance } from '@rspack/core';

const DEVELOPMENT_DESKTOP_ONLY_MARKERS = [
  'CustomInjected',
  'CustomInjection',
  'customInjection',
  'custom-injected',
  'custom_injected',
  'CUSTOM_INJECTION',
  'desktopPreloadUrl',
  'onekey_custom_injection_enabled',
] as const;

export class DevelopmentDesktopBuildScopePlugin implements RspackPluginInstance {
  private readonly platform: string;

  constructor(platform: string) {
    this.platform = platform;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(
      'DevelopmentDesktopBuildScopePlugin',
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'DevelopmentDesktopBuildScopePlugin',
            stage: rspack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
          },
          (assets) => {
            const leaks: string[] = [];
            for (const [fileName, asset] of Object.entries(assets)) {
              if (fileName.endsWith('.js')) {
                const source = asset.source().toString();
                for (const marker of DEVELOPMENT_DESKTOP_ONLY_MARKERS) {
                  if (source.includes(marker)) {
                    leaks.push(`${fileName}: ${marker}`);
                  }
                }
              }
            }
            if (leaks.length > 0) {
              compilation.errors.push(
                new Error(
                  `[DevelopmentDesktopBuildScopePlugin] ${this.platform} bundles must not contain Desktop development-only Custom Injection code:\n${leaks.join(
                    '\n',
                  )}`,
                ),
              );
            }
          },
        );
      },
    );
  }
}
