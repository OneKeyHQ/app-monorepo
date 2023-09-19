import { CoreChainScopeBase } from '../../base/CoreChainScopeBase';

import type CoreChainEvmHd from './CoreChainEvmHd';
import type CoreChainEvmImported from './CoreChainEvmImported';

export default class extends CoreChainScopeBase {
  override hd: CoreChainEvmHd = this._createApiProxy('hd') as CoreChainEvmHd;

  protected override _hd = async () =>
    (await import('./CoreChainEvmHd')).default;

  override imported: CoreChainEvmImported = this._createApiProxy(
    'imported',
  ) as CoreChainEvmImported;

  protected override _imported = async () =>
    (await import('./CoreChainEvmImported')).default;
}
