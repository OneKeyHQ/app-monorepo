// What the phone profile drawer flags, worked out in one place so the avatar
// dot always has a row to point at inside the drawer.

// Where an app update stands, as the Settings row should say it.
export type IProfileDrawerAppUpdate = 'available' | 'updating' | 'failed';

export type IProfileDrawerSignals = {
  isTravelMode: boolean;
  // The notification list has been opened at least once.
  notificationGuideOpened: boolean;
  unreadNotifications: number;
  unreadSupport: number;
  // Whether each count has loaded this launch. Until then its 0 means "not
  // known yet", so it may neither light the avatar nor move what was seen —
  // otherwise every restart would replay old unread items as new.
  notificationsKnown: boolean;
  supportKnown: boolean;
  appUpdate: IProfileDrawerAppUpdate | undefined;
  // One key per device and target version with a firmware update waiting.
  firmwareUpdateKeys: string[];
};

// What was pending the last time the drawer was open.
export type IProfileDrawerSeen = {
  opened: boolean;
  notifications: number;
  support: number;
  firmware: string[];
};

export type IProfileDrawerAvatarReason =
  | 'notifications'
  | 'support'
  | 'firmware';

export type IProfileDrawerMarks = {
  // Why the avatar shows its dot: news since the drawer was last open.
  avatarReasons: IProfileDrawerAvatarReason[];
  // Row marks stay until the thing itself is handled. No count means the
  // notification list was never opened.
  notifications: { count?: number } | undefined;
  // Unread support replies; 0 when none.
  support: number;
  appUpdate: IProfileDrawerAppUpdate | undefined;
  firmwareUpdate: boolean;
};

export const EMPTY_PROFILE_DRAWER_SEEN: IProfileDrawerSeen = {
  opened: false,
  notifications: 0,
  support: 0,
  firmware: [],
};

const FIRMWARE_SEEN_CAP = 50;

export function firmwareUpdateKey({
  connectId,
  toVersion,
  toVersionBle,
}: {
  connectId: string;
  toVersion?: string;
  toVersionBle?: string;
}) {
  return `${connectId}@${toVersion ?? ''}/${toVersionBle ?? ''}`;
}

export function computeProfileDrawerMarks(
  signals: IProfileDrawerSignals,
  seen: IProfileDrawerSeen,
): IProfileDrawerMarks {
  const {
    isTravelMode,
    notificationGuideOpened,
    unreadNotifications,
    unreadSupport,
    notificationsKnown,
    supportKnown,
    firmwareUpdateKeys,
  } = signals;
  // Travel mode masks the notification state and disables these rows, so a
  // mark there could never be cleared.
  const notificationsPending =
    !isTravelMode && (!notificationGuideOpened || unreadNotifications > 0);
  const avatarReasons: IProfileDrawerAvatarReason[] = [];
  if (!isTravelMode) {
    if (
      (!notificationGuideOpened && !seen.opened) ||
      (notificationsKnown && unreadNotifications > seen.notifications)
    ) {
      avatarReasons.push('notifications');
    }
    if (supportKnown && unreadSupport > seen.support) {
      avatarReasons.push('support');
    }
    if (firmwareUpdateKeys.some((key) => !seen.firmware.includes(key))) {
      avatarReasons.push('firmware');
    }
  }
  return {
    avatarReasons,
    notifications: notificationsPending
      ? {
          count:
            notificationGuideOpened && unreadNotifications > 0
              ? unreadNotifications
              : undefined,
        }
      : undefined,
    support: isTravelMode ? 0 : unreadSupport,
    // App updates have their own prompts, so they never light the avatar.
    appUpdate: signals.appUpdate,
    firmwareUpdate: !isTravelMode && firmwareUpdateKeys.length > 0,
  };
}

// Opening the drawer counts everything pending as seen.
export function seenOnOpen(
  signals: IProfileDrawerSignals,
  seen: IProfileDrawerSeen,
): IProfileDrawerSeen {
  const firmware = [
    ...new Set([...seen.firmware, ...signals.firmwareUpdateKeys]),
  ].slice(-FIRMWARE_SEEN_CAP);
  return {
    opened: true,
    notifications: signals.notificationsKnown
      ? signals.unreadNotifications
      : seen.notifications,
    support: signals.supportKnown ? signals.unreadSupport : seen.support,
    firmware,
  };
}

// Reading elsewhere lowers the bar, so the next new one lights the avatar.
export function settleSeen(
  signals: IProfileDrawerSignals,
  seen: IProfileDrawerSeen,
): IProfileDrawerSeen {
  const notifications = signals.notificationsKnown
    ? Math.min(seen.notifications, signals.unreadNotifications)
    : seen.notifications;
  const support = signals.supportKnown
    ? Math.min(seen.support, signals.unreadSupport)
    : seen.support;
  if (notifications === seen.notifications && support === seen.support) {
    return seen;
  }
  return { ...seen, notifications, support };
}

export function parseProfileDrawerSeen(
  raw: string | null | undefined,
): IProfileDrawerSeen {
  if (!raw) return EMPTY_PROFILE_DRAWER_SEEN;
  try {
    const value = JSON.parse(raw) as Partial<IProfileDrawerSeen> | null;
    return {
      opened: value?.opened === true,
      notifications:
        typeof value?.notifications === 'number' ? value.notifications : 0,
      support: typeof value?.support === 'number' ? value.support : 0,
      firmware: Array.isArray(value?.firmware)
        ? value.firmware.filter((key): key is string => typeof key === 'string')
        : [],
    };
  } catch {
    return EMPTY_PROFILE_DRAWER_SEEN;
  }
}
