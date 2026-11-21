import { OneKeyErrorScanQrCodeCancel } from '@onekeyhq/shared/src/errors';

export type IPublicAccountCreationContext = object;

const activeContexts = new WeakMap<
  IPublicAccountCreationContext,
  (() => boolean) | undefined
>();

/** Only background code can mint this capability; a serialized flag is inert. */
export async function withPublicAccountCreationContext<T>(
  operation: (context: IPublicAccountCreationContext) => Promise<T>,
  canContinue?: () => boolean,
): Promise<T> {
  const context = Object.freeze({});
  activeContexts.set(context, canContinue);
  try {
    assertPublicAccountCreationCanContinue(context);
    return await operation(context);
  } finally {
    activeContexts.delete(context);
  }
}

export function isPublicAccountCreationContext(
  context: IPublicAccountCreationContext | undefined,
): boolean {
  return !!context && activeContexts.has(context);
}

export function assertPublicAccountCreationCanContinue(
  context: IPublicAccountCreationContext | undefined,
) {
  if (context && activeContexts.get(context)?.() === false) {
    throw new OneKeyErrorScanQrCodeCancel();
  }
}
