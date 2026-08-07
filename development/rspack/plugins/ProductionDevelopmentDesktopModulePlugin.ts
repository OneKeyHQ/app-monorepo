import { rspack } from '@rspack/core';

import {
  DEVELOPMENT_DESKTOP_DIRECTORY_PATTERN,
  resolveProductionDevelopmentDesktopModuleRequest,
} from './productionDevelopmentDesktopModuleRequest';

import type { Compiler, RspackPluginInstance } from '@rspack/core';

export class ProductionDevelopmentDesktopModulePlugin implements RspackPluginInstance {
  apply(compiler: Compiler): void {
    new rspack.NormalModuleReplacementPlugin(DEVELOPMENT_DESKTOP_DIRECTORY_PATTERN, (data) => {
      data.request = resolveProductionDevelopmentDesktopModuleRequest(data.request);
    }).apply(compiler);
  }
}
