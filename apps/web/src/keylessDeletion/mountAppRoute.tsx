import { useEffect, useMemo, useRef, useState } from 'react';

import { createRoot } from 'react-dom/client';
import { useIntl } from 'react-intl';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@onekeyhq/components/src/actions/Toast';
import {
  SELECT_SEARCHABLE_PANEL_HEIGHT,
  Select,
} from '@onekeyhq/components/src/forms/Select';
import { SettingConfigContext } from '@onekeyhq/components/src/hocs/Provider/hooks/useProviderValue';
import { TamaguiProvider } from '@onekeyhq/components/src/hocs/Provider/TamaguiProvider';
import '@onekeyhq/components/src/hocs/Provider/web-fonts.css';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { Icon } from '@onekeyhq/components/src/primitives/Icon';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';
import { DESKTOP_MODE_UI_HEADER_HEIGHT } from '@onekeyhq/components/src/utils/sidebar';
import themeConfig from '@onekeyhq/components/tamagui.config';
import type { IHyperlinkTextProps } from '@onekeyhq/kit/src/components/HyperlinkText';
import { ErrorToastListener } from '@onekeyhq/kit/src/provider/Container/ErrorToastContainer/ErrorToastListener';
import { ONBOARDING_NARROW_CONTENT_WIDTH } from '@onekeyhq/kit/src/views/Onboardingv2/components/layoutConstants';
import { useLocaleOptions } from '@onekeyhq/kit/src/views/Setting/hooks/useLocaleOptions';
import { EAtomNames } from '@onekeyhq/kit-bg/src/states/jotai/atomNames';
import {
  buildJotaiStorageKey,
  onekeyJotaiStorage,
} from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import {
  KEYLESS_SUPABASE_PROJECT_URL,
  KEYLESS_SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations, type ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { AppIntlProvider } from '@onekeyhq/shared/src/locale/AppIntlProvider';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';
import { THEME_PRELOAD_STORAGE_KEY } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';

import { exchangeOAuthAccessToken } from './authentication';
import { createDeletionTransport } from './connection';
import { DeletionPage } from './DeletionPage';
import { KEYLESS_OAUTH_MARKER, getKeylessEntry } from './entry';
import {
  getPreferredLocale,
  readLocalePreference,
  resolveLocale,
  saveLocalePreference,
} from './localePreference';
import { messages } from './messages';
import { resetOnHistoryRestore } from './pageLifecycle';
import './styles.css';

import type { IBusinessAuth } from './useDeletionFlow';

function connect(
  transport: NonNullable<ReturnType<typeof createDeletionTransport>>,
): IBusinessAuth {
  return {
    origin: transport.apiOrigin,
    transport: transport.transport,
    async authenticate(provider, signal) {
      signal.throwIfAborted();
      const popup = globalThis.open(
        'about:blank',
        '_blank',
        'popup,width=480,height=660',
      );
      if (!popup)
        throw new DOMException(
          'Unable to open OAuth popup.',
          'NotAllowedError',
        );
      try {
        const token = await exchangeOAuthAccessToken(
          {
            origin: new URL(KEYLESS_SUPABASE_PROJECT_URL).origin,
            publicKey: KEYLESS_SUPABASE_PUBLIC_API_KEY,
          },
          provider,
          popup,
          signal,
          KEYLESS_OAUTH_MARKER,
        );
        if (!token)
          throw new DOMException(
            'OAuth session exchange failed.',
            'OperationError',
          );
        return token;
      } finally {
        if (!popup.closed) popup.close();
      }
    },
  };
}

function readAppTheme(): 'light' | 'dark' {
  try {
    const saved = globalThis.localStorage.getItem(THEME_PRELOAD_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Fall back to the system appearance if storage is unavailable.
  }
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function PlainToastText({ color, defaultMessage, size }: IHyperlinkTextProps) {
  return (
    <SizableText color={color} size={size}>
      {defaultMessage}
    </SizableText>
  );
}

function LanguageSelector({
  value,
  onChange,
}: {
  value: ILocaleSymbol;
  onChange: (locale: ILocaleSymbol) => void;
}) {
  const intl = useIntl();
  const options = useLocaleOptions().filter((item) => item.value !== 'en-US');
  const title = intl.formatMessage({ id: ETranslations.global_language });
  return (
    <Select
      testID="keyless-language-select"
      offset={{ mainAxis: 8, crossAxis: 8 }}
      title={title}
      items={options}
      value={value === 'en-US' ? 'en' : value}
      onChange={(key) => {
        if (options.some(({ value: item }) => item === key))
          onChange(getPreferredLocale(key));
      }}
      placement="bottom-end"
      searchable
      floatingPanelProps={{ maxHeight: SELECT_SEARCHABLE_PANEL_HEIGHT }}
      sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
      renderTrigger={({ label }) => (
        <Button
          testID="keyless-language-button"
          accessibilityLabel={title}
          size="small"
          icon="GlobusOutline"
          variant="tertiary"
        >
          {label}
        </Button>
      )}
    />
  );
}

function InviteRoute({
  business,
  invitationToken,
  onLanguageChange,
  preference,
}: {
  business: IBusinessAuth;
  invitationToken: string;
  onLanguageChange: (locale: ILocaleSymbol) => void;
  preference: ILocaleSymbol;
}) {
  return (
    <YStack
      className="keyless-app-route"
      testID="app-keyless-deletion"
      bg="$bgApp"
    >
      <XStack
        minHeight={DESKTOP_MODE_UI_HEADER_HEIGHT}
        px="$5"
        borderBottomWidth="$px"
        borderColor="$borderSubdued"
        ai="center"
        jc="space-between"
        gap="$2"
      >
        <XStack ai="center" gap="$2">
          <span aria-hidden="true">
            <Icon name="OnekeyBrand" size="$6" />
          </span>
          <SizableText size="$bodyMdMedium">OneKey</SizableText>
        </XStack>
        <LanguageSelector value={preference} onChange={onLanguageChange} />
      </XStack>
      <YStack
        className="keyless-app-content"
        w="100%"
        maxWidth={ONBOARDING_NARROW_CONTENT_WIDTH}
        px="$5"
        py="$6"
      >
        {invitationToken ? (
          <DeletionPage
            key={invitationToken}
            business={business}
            invitationToken={invitationToken}
          />
        ) : (
          <YStack render="main" gap="$4">
            <SizableText color="$textSubdued" testID="app-open-invitation">
              {messages.openInvitation}
            </SizableText>
          </YStack>
        )}
      </YStack>
    </YStack>
  );
}

function ThemedInvite({
  business,
  invitationToken,
  preference,
  onLanguageChange,
}: {
  business: IBusinessAuth;
  invitationToken: string;
  preference: ILocaleSymbol;
  onLanguageChange: (locale: ILocaleSymbol) => void;
}) {
  const [theme, setTheme] = useState(readAppTheme);
  const { locale } = useIntl();

  useEffect(() => {
    const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTheme(readAppTheme());
    media.addEventListener('change', update);
    globalThis.addEventListener('storage', update);
    return () => {
      media.removeEventListener('change', update);
      globalThis.removeEventListener('storage', update);
    };
  }, []);

  useEffect(() => {
    globalThis.document.documentElement.lang = locale;
  }, [locale]);

  const settings = useMemo(
    () => ({
      theme,
      locale: locale as ILocaleSymbol,
      hapticFeedbackEnabled: false,
      HyperlinkText: PlainToastText,
    }),
    [locale, theme],
  );

  return (
    <TamaguiProvider config={themeConfig} defaultTheme={theme}>
      <SettingConfigContext.Provider value={settings}>
        <SafeAreaProvider>
          <ErrorToastListener />
          <ToastHost />
          <InviteRoute
            business={business}
            invitationToken={invitationToken}
            preference={preference}
            onLanguageChange={onLanguageChange}
          />
        </SafeAreaProvider>
      </SettingConfigContext.Provider>
    </TamaguiProvider>
  );
}

function LocalizedInvite({
  business,
  invitationToken,
  initialPreference,
}: {
  business: IBusinessAuth;
  invitationToken: string;
  initialPreference: ILocaleSymbol;
}) {
  const [preference, setPreference] = useState(initialPreference);
  const save = useRef(Promise.resolve());

  function changeLanguage(locale: ILocaleSymbol) {
    save.current = save.current
      .then(async () => {
        await loadLocaleMessages(resolveLocale(locale));
        try {
          await saveLocalePreference(locale);
        } catch {
          // The active language can still change when browser storage is unavailable.
        }
        setPreference(locale);
      })
      .catch(() => {
        // Keep the current language if the App locale catalogue could not load.
      });
  }

  return (
    <AppIntlProvider locale={resolveLocale(preference)}>
      <ThemedInvite
        business={business}
        invitationToken={invitationToken}
        preference={preference}
        onLanguageChange={changeLanguage}
      />
    </AppIntlProvider>
  );
}

export async function mount(container: HTMLElement, invitationToken: string) {
  const page = new URL(globalThis.location.href);
  const defaults = { enabled: true, settings: { enableTestEndpoint: true } };
  const [devSettings, initialPreference] = await Promise.all([
    onekeyJotaiStorage
      .getItem(
        buildJotaiStorageKey(EAtomNames.devSettingsPersistAtom),
        defaults,
      )
      .catch(() => defaults),
    readLocalePreference(),
  ]);
  const connection = createDeletionTransport(page, {
    enabled: devSettings?.enabled === true,
    settings: {
      enableTestEndpoint: devSettings?.settings?.enableTestEndpoint === true,
    },
  });
  if (!connection) {
    container.textContent = messages.serviceClosed;
    return;
  }
  const business = connect(connection);
  await loadLocaleMessages(resolveLocale(initialPreference));
  const root = createRoot(container);
  const render = (token: string) => {
    root.render(
      <LocalizedInvite
        business={business}
        invitationToken={token}
        initialPreference={initialPreference}
      />,
    );
  };
  render(invitationToken);
  const onHashChange = () => {
    const entry = getKeylessEntry(new URL(globalThis.location.href));
    if (entry?.kind === 'invitation') render(entry.invitationToken);
  };
  globalThis.addEventListener('hashchange', onHashChange);
  globalThis.addEventListener(
    'pagehide',
    () => globalThis.removeEventListener('hashchange', onHashChange),
    { once: true },
  );
  resetOnHistoryRestore(root);
}
