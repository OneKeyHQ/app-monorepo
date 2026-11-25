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
  // The Intercom identity the support count belongs to: the signed-in user,
  // or `visitor:<id>` for an anonymous visitor; undefined until known.
  supportOwner?: string;
  // Whether each count has loaded this launch. Until then its 0 means "not
  // known yet", so it may neither light the avatar nor move what was seen —
  // otherwise every restart would replay old unread items as new.
  notificationsKnown: boolean;
  supportKnown: boolean;
  appUpdate: IProfileDrawerAppUpdate | undefined;
  // One key per device and target version with a firmware update waiting.
  firmwareUpdateKeys: string[];
};

// What was pending the last time the drawer was open. Support replies are
// counted per Intercom identity, so another identity's replies stay new.
export type IProfileDrawerSeen = {
  opened: boolean;
  notifications: number;
  support: Record<string, number>;
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
  support: {},
  firmware: [],
};

const FIRMWARE_SEEN_CAP = 50;
const SUPPORT_OWNERS_CAP = 8;

function seenSupportFor(seen: IProfileDrawerSeen, owner: string) {
  return seen.support[owner] ?? 0;
}

// The support record with this identity's count, keeping the latest few.
function withSeenSupport(
  support: Record<string, number>,
  owner: string,
  count: number,
) {
  const entries = [
    ...Object.entries(support).filter(([key]) => key !== owner),
    [owner, count] as const,
  ];
  return Object.fromEntries(entries.slice(-SUPPORT_OWNERS_CAP));
}

// Whether the support count can move what was seen: loaded, and its
// identity known.
function knownSupportOwner(signals: IProfileDrawerSignals) {
  return signals.supportKnown ? signals.supportOwner : undefined;
}

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
    firmwareUpdateKeys,
  } = signals;
  const supportOwner = knownSupportOwner(signals);
  // Travel mode masks the notification state and these rows don't open, so a
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
    if (
      supportOwner !== undefined &&
      unreadSupport > seenSupportFor(seen, supportOwner)
    ) {
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
  const supportOwner = knownSupportOwner(signals);
  return {
    opened: true,
    notifications: signals.notificationsKnown
      ? signals.unreadNotifications
      : seen.notifications,
    support:
      supportOwner === undefined
        ? seen.support
        : withSeenSupport(seen.support, supportOwner, signals.unreadSupport),
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
  const supportOwner = knownSupportOwner(signals);
  const seenSupport =
    supportOwner === undefined ? 0 : seenSupportFor(seen, supportOwner);
  const lowered =
    supportOwner !== undefined && signals.unreadSupport < seenSupport;
  if (notifications === seen.notifications && !lowered) {
    return seen;
  }
  return {
    ...seen,
    notifications,
    support:
      lowered && supportOwner !== undefined
        ? withSeenSupport(seen.support, supportOwner, signals.unreadSupport)
        : seen.support,
  };
}

// The desktop menu has no notification or device row: the bell and the device
// tab carry those, so support replies are all it counts.
export function toDesktopMenuSignals(
  signals: IProfileDrawerSignals,
): IProfileDrawerSignals {
  return {
    ...signals,
    notificationGuideOpened: true,
    unreadNotifications: 0,
    notificationsKnown: false,
    firmwareUpdateKeys: [],
  };
}

// Opening the menu marks only what it showed, so the extension's drawer,
// which shares this record, still flags the rest.
export function seenOnDesktopMenuOpen(
  signals: IProfileDrawerSignals,
  seen: IProfileDrawerSeen,
): IProfileDrawerSeen {
  const supportOwner = knownSupportOwner(signals);
  return {
    ...seen,
    support:
      supportOwner === undefined
        ? seen.support
        : withSeenSupport(seen.support, supportOwner, signals.unreadSupport),
  };
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
      // A count stored before identities were kept has no owner to apply to.
      support:
        value?.support && typeof value.support === 'object'
          ? Object.fromEntries(
              Object.entries(value.support).filter(
                (entry): entry is [string, number] =>
                  typeof entry[1] === 'number',
              ),
            )
          : {},
      firmware: Array.isArray(value?.firmware)
        ? value.firmware.filter((key): key is string => typeof key === 'string')
        : [],
    };
  } catch {
    return EMPTY_PROFILE_DRAWER_SEEN;
  }
}
