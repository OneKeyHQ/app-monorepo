export const ONE_KEY_ID_LAST_LOGIN_METHODS = [
  'email',
  'google',
  'apple',
] as const;

export type IOneKeyIdLastLoginMethod =
  (typeof ONE_KEY_ID_LAST_LOGIN_METHODS)[number];

export function resolveOneKeyIdLastLoginMethod(
  method: unknown,
): IOneKeyIdLastLoginMethod | undefined {
  if (method === 'email' || method === 'google' || method === 'apple') {
    return method;
  }
  return undefined;
}
