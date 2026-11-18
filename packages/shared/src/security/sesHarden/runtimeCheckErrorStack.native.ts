import { defaultStackParser } from '@sentry/react';

export function getSesErrorStackFrameCount(stack: string): number {
  return defaultStackParser(stack).filter(
    (frame) => !!frame.filename && typeof frame.lineno === 'number',
  ).length;
}
