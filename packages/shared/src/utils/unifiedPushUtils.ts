/**
 * UnifiedPush Utilities
 *
 * UnifiedPush is an open-source, privacy-friendly push notification specification
 * that allows users to choose their own push notification provider.
 *
 * Benefits:
 * - No Google Play Services required
 * - User chooses their push provider (distributor)
 * - End-to-end encryption possible
 * - No data collection by third parties
 * - Works on degoogled Android devices
 *
 * How it works:
 * 1. User installs a UnifiedPush distributor app (e.g., ntfy, NextPush)
 * 2. App registers with the distributor
 * 3. Distributor provides an endpoint URL
 * 4. Endpoint is sent to backend server
 * 5. Backend sends push messages to the endpoint
 * 6. Distributor delivers to the app
 *
 * @see https://unifiedpush.org/
 * @see https://unifiedpush.org/users/distributors/
 */

export interface IUnifiedPushDistributorInfo {
  packageName: string;
  displayName: string;
  description?: string;
  supportsEncryption?: boolean;
}

/**
 * Well-known UnifiedPush distributors
 * Users can install any of these to receive push notifications
 */
export const KNOWN_UNIFIEDPUSH_DISTRIBUTORS: IUnifiedPushDistributorInfo[] = [
  {
    packageName: 'io.heckel.ntfy',
    displayName: 'ntfy',
    description:
      'Simple HTTP-based pub-sub notification service. Self-hostable.',
    supportsEncryption: true,
  },
  {
    packageName: 'org.unifiedpush.distributor.nextpush',
    displayName: 'NextPush',
    description: 'Push notifications through your Nextcloud server.',
    supportsEncryption: true,
  },
  {
    packageName: 'org.unifiedpush.distributor.fcm',
    displayName: 'UP-FCM (Google FCM)',
    description:
      'Uses Google FCM as transport. Less private but widely available.',
    supportsEncryption: false,
  },
  {
    packageName: 'im.molly.unifiedpush',
    displayName: 'Molly UnifiedPush',
    description: 'UnifiedPush distributor from the Molly Signal fork.',
    supportsEncryption: true,
  },
  {
    packageName: 'org.unifiedpush.distributor.noprovider2push',
    displayName: 'NoProvider2Push',
    description: 'Direct push without a central server.',
    supportsEncryption: true,
  },
];

/**
 * Format endpoint URL for display (hide sensitive parts)
 */
export function formatEndpointForDisplay(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    // Show domain and truncated path
    const pathParts = url.pathname.split('/');
    if (pathParts.length > 2) {
      const lastPart = pathParts[pathParts.length - 1];
      const truncatedLast =
        lastPart.length > 8
          ? `${lastPart.substring(0, 4)}...${lastPart.substring(lastPart.length - 4)}`
          : lastPart;
      return `${url.host}/.../${truncatedLast}`;
    }
    return `${url.host}${url.pathname}`;
  } catch {
    // If URL parsing fails, just truncate
    if (endpoint.length > 40) {
      return `${endpoint.substring(0, 20)}...${endpoint.substring(endpoint.length - 15)}`;
    }
    return endpoint;
  }
}

/**
 * Check if a distributor package name is known/trusted
 */
export function isKnownDistributor(packageName: string): boolean {
  return KNOWN_UNIFIEDPUSH_DISTRIBUTORS.some(
    (d) => d.packageName === packageName,
  );
}

/**
 * Get info about a distributor by package name
 */
export function getDistributorInfo(
  packageName: string,
): IUnifiedPushDistributorInfo | undefined {
  return KNOWN_UNIFIEDPUSH_DISTRIBUTORS.find(
    (d) => d.packageName === packageName,
  );
}

/**
 * Check if the endpoint URL looks valid
 */
export function isValidEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Message format for sending via UnifiedPush
 * The backend should send messages in this format to the endpoint
 */
export interface IUnifiedPushOutgoingMessage {
  // Title of the notification
  title: string;
  // Body/content of the notification
  message: string;
  // Priority (1-5, with 5 being highest)
  priority?: number;
  // Topic for categorization
  topic?: string;
  // Custom data payload (will be JSON stringified)
  data?: Record<string, unknown>;
}

/**
 * Build a push message payload for sending to UnifiedPush endpoint
 */
export function buildPushMessagePayload(
  message: IUnifiedPushOutgoingMessage,
): string {
  return JSON.stringify({
    title: message.title,
    message: message.message,
    priority: message.priority ?? 3,
    data: {
      topic: message.topic,
      ...message.data,
    },
  });
}

/**
 * Privacy comparison between push providers
 */
export const PUSH_PROVIDER_PRIVACY_INFO = {
  unifiedpush: {
    name: 'UnifiedPush',
    privacyLevel: 'high',
    description:
      'User-controlled push provider. No data shared with Google or other third parties when using self-hosted distributors.',
    requiresGoogleServices: false,
    dataSentToThirdParty: false,
    selfHostable: true,
  },
  jpush: {
    name: 'JPush (极光推送)',
    privacyLevel: 'low',
    description:
      'Chinese push notification service. Data is processed through JPush servers.',
    requiresGoogleServices: false,
    dataSentToThirdParty: true,
    selfHostable: false,
  },
  fcm: {
    name: 'Firebase Cloud Messaging',
    privacyLevel: 'medium',
    description:
      'Google push service. Requires Google Play Services. Metadata visible to Google.',
    requiresGoogleServices: true,
    dataSentToThirdParty: true,
    selfHostable: false,
  },
  websocket: {
    name: 'WebSocket (In-App)',
    privacyLevel: 'high',
    description:
      'Direct connection to app servers. Only works when app is running.',
    requiresGoogleServices: false,
    dataSentToThirdParty: false,
    selfHostable: true,
  },
} as const;

export type TPushProviderType = keyof typeof PUSH_PROVIDER_PRIVACY_INFO;
