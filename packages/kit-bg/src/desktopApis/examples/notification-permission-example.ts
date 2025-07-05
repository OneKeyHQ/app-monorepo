import type { IDesktopApi } from '../instance/IDesktopApi';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

/**
 * 通知权限检查使用示例
 */
export class NotificationPermissionExample {
  constructor(private desktopApi: IDesktopApi) {}

  /**
   * 检查通知权限并根据结果采取行动
   */
  async checkAndRequestNotificationPermission(): Promise<void> {
    try {
      // 获取通知权限状态
      const permissionDetail = await this.desktopApi.notification.getNotificationPermission();
      
      console.log('通知权限检查结果:', {
        permission: permissionDetail.permission,
        isSupported: permissionDetail.isSupported,
        platformDetails: (permissionDetail as any).platformDetails,
      });

      // 根据权限状态采取不同的行动
      switch (permissionDetail.permission) {
        case ENotificationPermission.granted:
          console.log('✅ 通知权限已授权，可以发送通知');
          await this.sendTestNotification();
          break;

        case ENotificationPermission.denied:
          console.log('❌ 通知权限被拒绝');
          await this.handleDeniedPermission();
          break;

        case ENotificationPermission.default:
          console.log('❓ 通知权限状态未知，可能需要用户手动授权');
          await this.handleDefaultPermission();
          break;

        default:
          console.log('🔄 未知的权限状态');
          break;
      }
    } catch (error) {
      console.error('检查通知权限时发生错误:', error);
    }
  }

  /**
   * 发送测试通知
   */
  private async sendTestNotification(): Promise<void> {
    try {
      await this.desktopApi.notification.showNotification({
        title: 'OneKey 通知测试',
        description: '通知功能正常工作！',
        icon: undefined, // 可以添加图标路径
      });
      console.log('✅ 测试通知发送成功');
    } catch (error) {
      console.error('发送测试通知失败:', error);
    }
  }

  /**
   * 处理权限被拒绝的情况
   */
  private async handleDeniedPermission(): Promise<void> {
    console.log('📝 用户拒绝了通知权限，提供手动设置选项');
    
    // 可以在 UI 中显示提示，引导用户手动开启通知权限
    // 或者提供打开系统设置的选项
    try {
      await this.desktopApi.notification.openPermissionSettings();
      console.log('✅ 已打开系统通知设置');
    } catch (error) {
      console.error('打开系统设置失败:', error);
    }
  }

  /**
   * 处理权限状态未知的情况
   */
  private async handleDefaultPermission(): Promise<void> {
    console.log('⚠️ 通知权限状态未知，尝试发送通知以触发权限请求');
    
    // 尝试发送一个通知，这通常会触发系统的权限请求
    try {
      await this.sendTestNotification();
      
      // 稍后再次检查权限状态
      setTimeout(async () => {
        const updatedPermission = await this.desktopApi.notification.getNotificationPermission();
        console.log('更新后的权限状态:', updatedPermission.permission);
      }, 2000);
    } catch (error) {
      console.error('尝试发送通知失败:', error);
    }
  }

  /**
   * 定期检查权限状态（可选）
   */
  startPeriodicPermissionCheck(intervalMs: number = 30000): void {
    setInterval(async () => {
      try {
        const permission = await this.desktopApi.notification.getNotificationPermission();
        console.log('定期权限检查:', permission.permission);
        
        // 如果权限状态发生变化，可以触发相应的处理逻辑
        // 比如更新 UI 状态或重新配置通知功能
      } catch (error) {
        console.error('定期权限检查失败:', error);
      }
    }, intervalMs);
  }

  /**
   * 平台特定的权限检查示例
   */
  async checkPlatformSpecificPermission(): Promise<void> {
    const permission = await this.desktopApi.notification.getNotificationPermission();
    const platformDetails = (permission as any).platformDetails;

    switch (process.platform) {
      case 'darwin': // macOS
        console.log('macOS 特定信息:', platformDetails);
        if (platformDetails?.doNotDisturb) {
          console.log('⚠️ 检测到 macOS 勿扰模式已开启');
        }
        break;

      case 'win32': // Windows
        console.log('Windows 特定信息:', platformDetails);
        if (platformDetails?.reason === 'no_app_user_model_id') {
          console.log('⚠️ Windows 应用需要设置 AppUserModelID');
        }
        break;

      case 'linux': // Linux
        console.log('Linux 特定信息:', platformDetails);
        if (platformDetails?.desktopEnv) {
          console.log('🖥️ 检测到桌面环境:', platformDetails.desktopEnv);
        }
        break;

      default:
        console.log('未知平台:', process.platform);
        break;
    }
  }
} 