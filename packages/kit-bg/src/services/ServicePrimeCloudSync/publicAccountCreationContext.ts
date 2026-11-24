export type IPublicAccountCreationContext = object;

const activeContexts = new WeakSet<IPublicAccountCreationContext>();

/** Only background code can mint this capability; a serialized flag is inert. */
export async function withPublicAccountCreationContext<T>(
  operation: (context: IPublicAccountCreationContext) => Promise<T>,
): Promise<T> {
  const context = Object.freeze({});
  activeContexts.add(context);
  try {
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
