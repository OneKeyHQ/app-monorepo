import appGlobals from '../../appGlobals';

import {
  type EIntercomBridge,
  INTERCOM_SUPPORT_URL,
  resolveIntercomSupportUrlOverride,
} from './bridge';

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

// Reads the developer-mode support page override from the background runtime.
export const getIntercomSupportUrlOverride = async (): Promise<
  string | undefined
> => {
  try {
    const backgroundApiProxy = appGlobals.$backgroundApiProxy;

    if (!backgroundApiProxy) {
      return undefined;
    }

    return resolveIntercomSupportUrlOverride(
      await backgroundApiProxy.serviceDevSetting.getDevSetting(),
    );
  } catch (error) {
    console.warn('Failed to read Intercom support URL override:', error);
  }

  return undefined;
};

export const getIntercomSupportUrl = async (): Promise<string> =>
  (await getIntercomSupportUrlOverride()) ?? INTERCOM_SUPPORT_URL;

export type IShowIntercomParams = {
  requestId?: string;
  conversationId?: string;
};

export function createIntercomOpenGuard(onError: (error: unknown) => void) {
  type IOpen = { pending?: Promise<void>; cooldownUntil: number };
  let state:
    | {
        userId: string | null;
        conversationRevision: number;
        opens: Map<string, IOpen>;
      }
    | undefined;
  const setIdentity = (userId: string | null) => {
    if (!state || state.userId !== userId) {
      state = { userId, conversationRevision: 0, opens: new Map() };
    }
    return state;
  };

  return {
    setIdentity,
    reset() {
      state = undefined;
    },
    run(
      userId: string | null,
      params: IShowIntercomParams | undefined,
      open: (canPresent: () => boolean) => Promise<boolean>,
    ): Promise<void> {
      const current = setIdentity(userId);
      const now = performance.now();
      for (const [key, entry] of current.opens) {
        if (!entry.pending && entry.cooldownUntil <= now) {
          current.opens.delete(key);
        }
      }
      const targeted = !!params?.conversationId;
      const key = params?.requestId ?? '';
      if (targeted) {
        // A late ordinary open must not replace a notification's conversation.
        current.conversationRevision += 1;
        current.opens.clear();
      } else {
        const previous = current.opens.get(key);
        if (previous?.pending) {
          return previous.pending;
        }
        if (previous && previous.cooldownUntil > now) {
          return Promise.resolve();
        }
      }
      const revision = current.conversationRevision;
      const entry: IOpen = { cooldownUntil: 0 };
      const operation = Promise.resolve()
        .then(() =>
          open(
            () =>
              state === current && current.conversationRevision === revision,
          ),
        )
        .then((opened) => {
          if (!targeted && current.opens.get(key) === entry) {
            if (opened) {
              // Android resolves present before the presentation animation ends.
              entry.cooldownUntil = performance.now() + 1000;
            } else {
              current.opens.delete(key);
            }
          }
        })
        .catch((error: unknown) => {
          if (current.opens.get(key) === entry) {
            current.opens.delete(key);
          }
          onError(error);
        })
        .finally(() => {
          if (current.opens.get(key) === entry) {
            entry.pending = undefined;
          }
        });
      if (!targeted) {
        entry.pending = operation;
        current.opens.set(key, entry);
      }
      return operation;
    },
  };
}

// Native only compares timestamps: the Messenger must close when
// now < validFromMs or now >= lockAtMs (see passwordUtils auto-lock rule).
export type IIntercomLockPolicy = {
  validFromMs: number;
  lockAtMs: number;
};

// Credentials never belong here: URLs reach gateway logs, browser history,
// Sentry and analytics. The JWT travels over the bridge named in the fragment.
export const buildIntercomUrl = (
  baseUrl: string,
  params: {
    bridge: EIntercomBridge;
    parentOrigin?: string;
    instanceId?: string;
    requestId?: string;
    conversationId?: string;
    languageOverride?: string;
  },
): string => {
  let url = baseUrl;

  // Add instanceId if provided
  if (params.instanceId) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}instanceId=${encodeURIComponent(params.instanceId)}`;
  }

  // Add requestId if provided
  if (params.requestId) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}requestId=${encodeURIComponent(params.requestId)}`;
  }

  if (params.conversationId) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}conversationId=${encodeURIComponent(
      params.conversationId,
    )}`;
  }

  if (params.languageOverride) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}language_override=${encodeURIComponent(
      params.languageOverride,
    )}`;
  }

  url += `#bridge=${params.bridge}`;
  if (params.parentOrigin) {
    url += `&parentOrigin=${encodeURIComponent(params.parentOrigin)}`;
  }

  return url;
};
