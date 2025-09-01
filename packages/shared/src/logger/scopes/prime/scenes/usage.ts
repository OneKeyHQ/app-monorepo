import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class PrimeUsageScene extends BaseScene {
  /**
   * 使用 OneKey Cloud
   * 触发时机: Prime 用户点击 OneKey Cloud 的开关时触发
   */
  @LogToServer()
  public onekeyCloudToggle({ status }: { status: 'on' | 'off' }) {
    return {
      status,
    };
  }

  /**
   * 使用批量复制地址
   * 触发时机: Prime 用户成功执行一次"批量复制地址"操作后触发
   */
  @LogToServer()
  public bulkCopyAddressSuccess() {
    return {};
  }

  /**
   * 使用批量撤销
   * 触发时机: Prime 用户成功执行一次"批量撤销"操作后触发
   */
  @LogToServer()
  public bulkRevokeSuccess({ revokeCount }: { revokeCount: number }) {
    return {
      revokeCount,
    };
  }
}
