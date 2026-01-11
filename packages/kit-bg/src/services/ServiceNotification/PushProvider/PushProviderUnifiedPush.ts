import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INotificationPushMessageInfo } from '@onekeyhq/shared/types/notification';
import { EPushProviderEventNames } from '@onekeyhq/shared/types/notification';

import { PushProviderBase } from './PushProviderBase';

import type { IPushProviderBaseProps } from './PushProviderBase';

/**
 * UnifiedPush Provider
 *
 * UnifiedPush is an open standard for push notifications that respects user privacy.
 * It allows users to choose their own push notification provider (distributor),
 * eliminating the need for Google Play Services or proprietary push services.
 *
 * Flow:
 * 1. User installs a UnifiedPush distributor app (e.g., ntfy, NextPush, UP-FCM)
 * 2. App registers with the distributor to get an endpoint URL
 * 3. Endpoint URL is sent to the app's server
 * 4. Server sends push messages to the endpoint URL
 * 5. Distributor delivers messages to the app
 *
 * @see https://unifiedpush.org/
 */

export interface IUnifiedPushMessage {
  title?: string;
  message: string;
  priority?: number;
  // Custom data payload
  data?: Record<string, unknown>;
}

export interface IUnifiedPushEndpoint {
  endpoint: string;
  pubKey?: string;
  auth?: string;
}

export interface IUnifiedPushDistributor {
  packageName: string;
  name: string;
}

export type UnifiedPushEventType =
  | 'registered'
  | 'unregistered'
  | 'message'
  | 'newEndpoint'
  | 'registrationFailed'
  | 'unregistrationFailed';

export interface IUnifiedPushEventPayload {
  type: UnifiedPushEventType;
  endpoint?: string;
  message?: string;
  instance?: string;
  error?: string;
}

// Native module interface - will be implemented in native code
interface IUnifiedPushNativeModule {
  initialize(): Promise<void>;
  registerForPush(instance: string): Promise<void>;
  unregisterForPush(instance: string): Promise<void>;
  getDistributor(): Promise<string | null>;
  getDistributors(): Promise<IUnifiedPushDistributor[]>;
  selectDistributor(packageName: string): Promise<void>;
  getEndpoint(instance: string): Promise<string | null>;
  isRegistered(instance: string): Promise<boolean>;
}

// This will be imported from the native module when implemented
let UnifiedPushModule: IUnifiedPushNativeModule | null = null;

try {
  if (platformEnv.isNative) {
    // Dynamic import to avoid errors on platforms where the module isn't available
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require
    const { NativeModules } = require('react-native') as {
      NativeModules: { UnifiedPushModule?: IUnifiedPushNativeModule };
    };
    UnifiedPushModule = NativeModules.UnifiedPushModule || null;
  }
} catch (error) {
  defaultLogger.notification.common.consoleLog(
    'UnifiedPush native module not available',
    error,
  );
}

export class PushProviderUnifiedPush extends PushProviderBase {
  constructor(props: IPushProviderBaseProps) {
    super(props);
    void this.initUnifiedPush();
  }

  private endpoint: string | null = null;

  private isInitialized = false;

  private async initUnifiedPush() {
    if (!platformEnv.isNative || !UnifiedPushModule) {
      defaultLogger.notification.common.consoleLog(
        'UnifiedPush not available on this platform',
      );
      return;
    }

    try {
      await UnifiedPushModule.initialize();
      this.setupEventListeners();
      this.isInitialized = true;
      defaultLogger.notification.common.consoleLog(
        'UnifiedPush initialized successfully',
      );

      // Check if already registered
      const isRegistered = await UnifiedPushModule.isRegistered(
        this.instanceId,
      );
      if (isRegistered) {
        const existingEndpoint = await UnifiedPushModule.getEndpoint(
          this.instanceId,
        );
        if (existingEndpoint) {
          this.endpoint = existingEndpoint;
          this.eventEmitter.emit(EPushProviderEventNames.unifiedpush_connected, {
            endpoint: existingEndpoint,
          });
        }
      }
    } catch (error) {
      defaultLogger.notification.common.consoleError(
        'UnifiedPush initialization failed',
        error,
      );
    }
  }

  private setupEventListeners() {
    if (!platformEnv.isNative) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require
      const { DeviceEventEmitter } = require('react-native') as {
        DeviceEventEmitter: {
          addListener: (
            event: string,
            callback: (event: IUnifiedPushEventPayload) => void,
          ) => void;
        };
      };

      DeviceEventEmitter.addListener(
        'UnifiedPushEvent',
        (event: IUnifiedPushEventPayload) => {
          this.handleUnifiedPushEvent(event);
        },
      );
    } catch (error) {
      defaultLogger.notification.common.consoleError(
        'Failed to setup UnifiedPush event listeners',
        error,
      );
    }
  }

  private handleUnifiedPushEvent(event: IUnifiedPushEventPayload) {
    defaultLogger.notification.common.consoleLog('UnifiedPush event:', event);

    switch (event.type) {
      case 'registered':
      case 'newEndpoint':
        if (event.endpoint) {
          this.endpoint = event.endpoint;
          this.eventEmitter.emit(EPushProviderEventNames.unifiedpush_connected, {
            endpoint: event.endpoint,
          });
          defaultLogger.notification.common.consoleLog(
            'UnifiedPush registered with endpoint:',
            event.endpoint,
          );
        }
        break;

      case 'unregistered':
        this.endpoint = null;
        defaultLogger.notification.common.consoleLog('UnifiedPush unregistered');
        break;

      case 'message':
        if (event.message) {
          this.handleMessage(event.message);
        }
        break;

      case 'registrationFailed':
        defaultLogger.notification.common.consoleError(
          'UnifiedPush registration failed:',
          event.error,
        );
        break;

      case 'unregistrationFailed':
        defaultLogger.notification.common.consoleError(
          'UnifiedPush unregistration failed:',
          event.error,
        );
        break;

      default:
        defaultLogger.notification.common.consoleLog(
          'Unknown UnifiedPush event type:',
          event.type,
        );
    }
  }

  private handleMessage(rawMessage: string) {
    try {
      // Try to parse as JSON first (structured message)
      let parsedMessage: IUnifiedPushMessage;

      try {
        parsedMessage = JSON.parse(rawMessage) as IUnifiedPushMessage;
      } catch {
        // If not JSON, treat as plain text message
        parsedMessage = {
          message: rawMessage,
        };
      }

      const msgId =
        (parsedMessage.data?.msgId as string) ||
        `up_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const payload: INotificationPushMessageInfo = {
        pushSource: 'unifiedpush',
        title: parsedMessage.title || 'Notification',
        content: parsedMessage.message,
        extras: {
          msgId,
          topic:
            (parsedMessage.data?.topic as string) || 'accountActivity',
          params: parsedMessage.data?.params as any,
          ...(parsedMessage.data || {}),
        } as any,
      };

      defaultLogger.notification.common.consoleLog(
        'UnifiedPush message received:',
        payload,
      );

      this.eventEmitter.emit(
        EPushProviderEventNames.notification_received,
        payload,
      );
    } catch (error) {
      defaultLogger.notification.common.consoleError(
        'Failed to parse UnifiedPush message:',
        error,
        rawMessage,
      );
    }
  }

  /**
   * Get available UnifiedPush distributors on the device
   */
  async getDistributors(): Promise<IUnifiedPushDistributor[]> {
    if (!UnifiedPushModule) {
      return [];
    }
    try {
      return await UnifiedPushModule.getDistributors();
    } catch (error) {
      defaultLogger.notification.common.consoleError(
        'Failed to get UnifiedPush distributors:',
        error,
      );
      return [];
    }
  }

  /**
   * Select a UnifiedPush distributor
   */
  async selectDistributor(packageName: string): Promise<boolean> {
    if (!UnifiedPushModule) {
      return false;
    }
    try {
      await UnifiedPushModule.selectDistributor(packageName);
      return true;
    } catch (error) {
      defaultLogger.notification.common.consoleError(
        'Failed to select UnifiedPush distributor:',
        error,
      );
      return false;
    }
  }

  /**
   * Register for push notifications with UnifiedPush
   */
  async register(): Promise<boolean> {
    if (!UnifiedPushModule) {
      defaultLogger.notification.common.consoleLog(
        'UnifiedPush module not available',
      );
      return false;
    }

    try {
      await UnifiedPushModule.registerForPush(this.instanceId);
      return true;
    } catch (error) {
      defaultLogger.notification.common.consoleError(
        'UnifiedPush registration failed:',
        error,
      );
      return false;
    }
  }

  /**
   * Unregister from push notifications
   */
  async unregister(): Promise<boolean> {
    if (!UnifiedPushModule) {
      return false;
    }

    try {
      await UnifiedPushModule.unregisterForPush(this.instanceId);
      this.endpoint = null;
      return true;
    } catch (error) {
      defaultLogger.notification.common.consoleError(
        'UnifiedPush unregistration failed:',
        error,
      );
      return false;
    }
  }

  /**
   * Get the current endpoint URL for sending push notifications
   */
  getEndpoint(): string | null {
    return this.endpoint;
  }

  /**
   * Check if UnifiedPush is available on this device
   */
  isAvailable(): boolean {
    return !!UnifiedPushModule && this.isInitialized;
  }

  /**
   * Check if currently registered
   */
  async isRegistered(): Promise<boolean> {
    if (!UnifiedPushModule) {
      return false;
    }
    try {
      return await UnifiedPushModule.isRegistered(this.instanceId);
    } catch {
      return false;
    }
  }

  /**
   * Get current distributor
   */
  async getCurrentDistributor(): Promise<string | null> {
    if (!UnifiedPushModule) {
      return null;
    }
    try {
      return await UnifiedPushModule.getDistributor();
    } catch {
      return null;
    }
  }
}
