export type ICaptchaMessage = {
  type: 'onekey-test-captcha';
  requestId: string;
  status: 'ready' | 'success' | 'expired' | 'timeout' | 'error' | 'load-error';
  token?: string;
};

export function parseCaptchaMessage(
  data: unknown,
  requestId: string,
): ICaptchaMessage | undefined {
  let value: unknown = data;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (!value || typeof value !== 'object') return undefined;
  const message = value as Partial<ICaptchaMessage>;
  if (
    message.type !== 'onekey-test-captcha' ||
    message.requestId !== requestId ||
    !['ready', 'success', 'expired', 'timeout', 'error', 'load-error'].includes(
      message.status || '',
    )
  ) {
    return undefined;
  }
  if (
    message.status === 'success' &&
    (typeof message.token !== 'string' ||
      !message.token ||
      message.token.length > 2048)
  ) {
    return undefined;
  }
  return {
    type: 'onekey-test-captcha',
    requestId,
    status: message.status as ICaptchaMessage['status'],
    token: message.status === 'success' ? message.token : undefined,
  };
}

export function isCaptchaOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

export const DESKTOP_CAPTCHA_MESSAGE_CHANNEL = 'onekey:captcha-result';

const CAPTCHA_PAGE_ORIGINS = new Set([
  'https://login.onekey.so',
  'https://login.onekeytest.com',
]);

export function isDesktopCaptchaPage(url: string): boolean {
  try {
    const page = new URL(url);
    return (
      !page.username &&
      !page.password &&
      CAPTCHA_PAGE_ORIGINS.has(page.origin) &&
      ['/captcha', '/captcha/', '/captcha/index.html'].includes(page.pathname)
    );
  } catch {
    return false;
  }
}
