import {
  ENotificationCommand,
  ENotificationPushMessageMode,
} from '../../types/notification';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isSupportNotification(data: unknown): boolean {
  if (!isRecord(data)) {
    return false;
  }
  // Expo remote notifications can wrap their original data in body on iOS.
  const body = isRecord(data.body) ? data.body : data;
  const extras = isRecord(body.extras) ? body.extras : body;
  if (
    (extras.mode !== ENotificationPushMessageMode.command &&
      extras.mode !== String(ENotificationPushMessageMode.command)) ||
    typeof extras.payload !== 'string'
  ) {
    return false;
  }
  try {
    const command: unknown = JSON.parse(extras.payload);
    return (
      isRecord(command) &&
      command.action === ENotificationCommand.openSupportConversation
    );
  } catch {
    return false;
  }
}
