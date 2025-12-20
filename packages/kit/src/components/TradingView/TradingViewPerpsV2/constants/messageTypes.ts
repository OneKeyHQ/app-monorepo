export const MESSAGE_TYPES = {
  MARKS_UPDATE: 'MARKS_UPDATE',
  MARKS_RESPONSE: 'MARKS_RESPONSE',
} as const;

export type IMessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];
