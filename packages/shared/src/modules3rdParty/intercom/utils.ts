import appGlobals from '../../appGlobals';

const INTERCOM_LANGUAGE_OVERRIDES: Record<string, string> = {
  bn: 'bn',
  de: 'de',
  en: 'en',
  'en-us': 'en',
  es: 'es',
  fr: 'fr',
  'fr-fr': 'fr',
  hi: 'hi',
  'hi-in': 'hi',
  id: 'id',
  it: 'it',
  'it-it': 'it',
  ja: 'ja',
  'ja-jp': 'ja',
  ko: 'ko',
  'ko-kr': 'ko',
  pt: 'pt',
  'pt-br': 'pt-BR',
  ru: 'ru',
  th: 'th',
  'th-th': 'th',
  uk: 'uk',
  'uk-ua': 'uk',
  vi: 'vi',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-hk': 'zh-TW',
  'zh-hant': 'zh-TW',
  'zh-tw': 'zh-TW',
};

export const toIntercomLanguageOverride = (
  locale: string | null | undefined,
): string => {
  const normalizedLocale = locale?.trim().replace(/_/g, '-');

  if (
    !normalizedLocale ||
    ['null', 'undefined'].includes(normalizedLocale.toLowerCase())
  ) {
    return 'en';
  }

  const localeKey = normalizedLocale.toLowerCase();
  const languageKey = localeKey.split('-')[0];

  return (
    INTERCOM_LANGUAGE_OVERRIDES[localeKey] ??
    INTERCOM_LANGUAGE_OVERRIDES[languageKey] ??
    'en'
  );
};

export const getCustomerJWT = async (): Promise<string | undefined> => {
  try {
    // Use appGlobals to access backgroundApiProxy instead of direct import
    const backgroundApiProxy = appGlobals.$backgroundApiProxy;

    if (!backgroundApiProxy) {
      console.warn('backgroundApiProxy not available for customer JWT');
      return undefined;
    }

    // Check if user is logged in to OneKey ID
    const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();

    if (isLoggedIn) {
      // Get customer JWT if logged in
      const response =
        await backgroundApiProxy.servicePrime.apiGetCustomerJWT();

      return response?.token;
    }
  } catch (error) {
    console.warn('Failed to get customer JWT for Intercom:', error);
  }

  return undefined;
};

export const getInstanceId = async (): Promise<string | undefined> => {
  try {
    const backgroundApiProxy = appGlobals.$backgroundApiProxy;

    if (!backgroundApiProxy) {
      console.warn('backgroundApiProxy not available for instance ID');
      return undefined;
    }

    return await backgroundApiProxy.serviceSetting.getInstanceId();
  } catch (error) {
    console.warn('Failed to get instance ID for Intercom:', error);
  }

  return undefined;
};

export const getCurrentLocale = async (): Promise<string | undefined> => {
  try {
    const backgroundApiProxy = appGlobals.$backgroundApiProxy;

    if (!backgroundApiProxy) {
      console.warn('backgroundApiProxy not available for current locale');
      return undefined;
    }

    return await backgroundApiProxy.serviceSetting.getCurrentLocale();
  } catch (error) {
    console.warn('Failed to get current locale for Intercom:', error);
  }

  return undefined;
};

export const getIntercomLanguageOverride = async (): Promise<string> =>
  toIntercomLanguageOverride(await getCurrentLocale());

export const buildIntercomUrl = (
  baseUrl: string,
  params?: {
    token?: string;
    instanceId?: string;
    requestId?: string;
    languageOverride?: string;
  },
): string => {
  let url = baseUrl;

  // Add token if provided
  if (params?.token) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}intercom_user_jwt=${encodeURIComponent(params.token)}`;
  }

  // Add instanceId if provided
  if (params?.instanceId) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}instanceId=${encodeURIComponent(params.instanceId)}`;
  }

  // Add requestId if provided
  if (params?.requestId) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}requestId=${encodeURIComponent(params.requestId)}`;
  }

  if (params?.languageOverride) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}language_override=${encodeURIComponent(
      params.languageOverride,
    )}`;
  }

  return url;
};
