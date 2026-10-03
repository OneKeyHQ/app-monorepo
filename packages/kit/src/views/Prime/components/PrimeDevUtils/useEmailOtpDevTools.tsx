import { useCallback, useRef, useState } from 'react';

import { createClient } from '@supabase/supabase-js';
import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  Input,
  SizableText,
  Stack,
  Switch,
  XStack,
} from '@onekeyhq/components';
import {
  EMAIL_OTP_CAPTCHA_PAGE_URLS,
  EMAIL_OTP_TEST_PROJECTS,
} from '@onekeyhq/kit/src/components/Captcha/dev/emailOtpTestConfig';
import { requestEmailOtp } from '@onekeyhq/kit/src/components/OneKeyAuth/supabase/requestEmailOtp';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getOneKeyIdAuthConfigByDevSettings } from '@onekeyhq/shared/src/config/oneKeyIdAuth';
import {
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { PrimeResetPasswordTest } from './PrimeResetPasswordTest';

import type { Session, SupabaseClient } from '@supabase/supabase-js';

type IDevConfig = {
  projectUrl: string;
  publicKey: string;
  captchaEnabled: boolean;
  captchaPageUrl: string;
  passwordLoginEnabled: boolean;
};

async function verifyIsolatedSession(
  client: SupabaseClient,
  session: Session | null,
) {
  if (!session)
    throw new OneKeyLocalError('Test Supabase returned no session.');
  const user = await client.auth.getUser(session.access_token);
  if (user.error || user.data.user?.id !== session.user.id) {
    throw new OneKeyLocalError('Test Supabase session verification failed.');
  }
}

const SUPABASE_PROJECT_OPTIONS = [
  {
    id: 'production',
    label: 'Production',
    projectUrl: SUPABASE_PROJECT_URL,
    publicKey: SUPABASE_PUBLIC_API_KEY,
  },
  ...EMAIL_OTP_TEST_PROJECTS,
];

const CAPTCHA_PAGE_OPTIONS = [
  { id: 'test', label: 'Test', url: EMAIL_OTP_CAPTCHA_PAGE_URLS.test },
  {
    id: 'production',
    label: 'Production',
    url: EMAIL_OTP_CAPTCHA_PAGE_URLS.production,
  },
];

function isCurrentProject(
  projectUrl: string,
  currentProjectUrl: string,
): boolean {
  try {
    return new URL(projectUrl).href.replace(/\/$/, '') === currentProjectUrl;
  } catch {
    return false;
  }
}

function isDirectSupabaseUrl(projectUrl: string): boolean {
  try {
    const { hostname, protocol } = new URL(projectUrl);
    return (
      (protocol === 'https:' || protocol === 'http:') &&
      (hostname === 'supabase.co' || hostname.endsWith('.supabase.co'))
    );
  } catch {
    return false;
  }
}

function getProjectPublicKey(projectUrl: string): string {
  try {
    const normalizedUrl = new URL(projectUrl).href.replace(/\/$/, '');
    return (
      SUPABASE_PROJECT_OPTIONS.find(
        (project) => project.projectUrl === normalizedUrl,
      )?.publicKey ?? ''
    );
  } catch {
    return '';
  }
}

function getConfigError(config: IDevConfig): string | undefined {
  try {
    const url = new URL(config.projectUrl);
    if (
      url.protocol !== 'https:' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      url.port
    ) {
      return 'Enter a configured HTTPS authentication URL.';
    }
    if (
      !config.publicKey ||
      config.publicKey !== getProjectPublicKey(config.projectUrl)
    ) {
      return 'Select a configured Supabase project.';
    }
  } catch {
    return 'Enter a valid Supabase project URL.';
  }
  return undefined;
}

export function useEmailOtpDevTools({
  openCount,
  email,
  sendCode: originalSendCode,
  loginWithCode: originalLoginWithCode,
}: {
  openCount: number;
  email: string;
  sendCode: (args: { email: string; captchaToken?: string }) => Promise<void>;
  loginWithCode: (args: { email: string; code: string }) => Promise<void>;
}) {
  const [devSettings] = useDevSettingsPersistAtom();
  const available = devSettings.enabled && openCount > 0;
  const authConfig = getOneKeyIdAuthConfigByDevSettings(devSettings);
  const intl = useIntl();
  const mounted = useIsMounted();
  const [config, setConfig] = useState<IDevConfig>({
    projectUrl: authConfig.projectUrl,
    publicKey: authConfig.publicKey,
    captchaEnabled: authConfig.captcha.enabled,
    captchaPageUrl: authConfig.captcha.pageUrl,
    passwordLoginEnabled: false,
  });
  const [revision, setRevision] = useState(0);
  const [closedAtOpenCount, setClosedAtOpenCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const onResetBusyChange = useCallback((value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  }, []);
  const isTestProject =
    available && !isCurrentProject(config.projectUrl, authConfig.projectUrl);
  const configError = available ? getConfigError(config) : undefined;
  const isPasswordLogin = available && config.passwordLoginEnabled;

  const updateConfig = (patch: Partial<IDevConfig>) => {
    if (busyRef.current) return;
    const next = { ...config, ...patch };
    setConfig(next);
    setRevision((current) => current + 1);
  };

  const createIsolatedClient = useCallback(() => {
    if (!available || getConfigError(config)) {
      throw new OneKeyLocalError(
        'Invalid isolated Supabase test configuration.',
      );
    }
    return createClient(config.projectUrl, config.publicKey, {
      auth: {
        flowType: 'pkce',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `onekey-id-dialog-test-${generateUUID()}`,
      },
    });
  }, [available, config]);

  const sendCode = useCallback(
    async (args: { email: string; captchaToken?: string }) => {
      if (!available) return originalSendCode(args);
      if (busyRef.current || configError) {
        throw new OneKeyLocalError(
          configError || 'An auth request is in progress.',
        );
      }
      busyRef.current = true;
      setBusy(true);
      try {
        if (isTestProject) {
          await requestEmailOtp({
            client: createIsolatedClient(),
            email: args.email,
            captchaToken: args.captchaToken,
            intl,
          });
        } else {
          await originalSendCode(args);
        }
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [
      available,
      configError,
      createIsolatedClient,
      intl,
      isTestProject,
      mounted,
      originalSendCode,
    ],
  );

  const loginWithCode = useCallback(
    async (args: { email: string; code: string }) => {
      if (!isTestProject) return originalLoginWithCode(args);
      if (busyRef.current)
        throw new OneKeyLocalError('An auth request is in progress.');
      busyRef.current = true;
      setBusy(true);
      try {
        const client = createIsolatedClient();
        const { data, error } = await client.auth.verifyOtp({
          email: args.email,
          token: args.code,
          type: 'email',
        });
        if (error) throw error;
        await verifyIsolatedSession(client, data.session);
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [createIsolatedClient, isTestProject, mounted, originalLoginWithCode],
  );

  const loginWithPassword = useCallback(
    async (args: {
      email: string;
      password: string;
      captchaToken?: string;
    }) => {
      if (!isPasswordLogin) {
        throw new OneKeyLocalError('Password test mode is disabled.');
      }
      if (busyRef.current) {
        throw new OneKeyLocalError('An auth request is in progress.');
      }
      busyRef.current = true;
      setBusy(true);
      try {
        const client = createIsolatedClient();
        const { data, error } = await client.auth.signInWithPassword({
          email: args.email,
          password: args.password,
          ...(args.captchaToken
            ? { options: { captchaToken: args.captchaToken } }
            : {}),
        });
        if (error) throw error;
        await verifyIsolatedSession(client, data.session);
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [createIsolatedClient, isPasswordLogin, mounted],
  );

  const renderControls = (disabled = false, authActionPending = disabled) =>
    available && closedAtOpenCount !== openCount ? (
      <Stack
        gap="$2"
        p="$3"
        mb="$3"
        backgroundColor="$bgCaution"
        borderWidth={1}
        borderColor="$borderCautionSubdued"
        borderRadius="$3"
        testID="prime-email-otp-dev-controls"
      >
        <XStack gap="$2" alignItems="flex-start">
          <XStack flex={1} gap="$2" flexWrap="wrap">
            {SUPABASE_PROJECT_OPTIONS.map(
              ({ id, label, projectUrl, publicKey }) => (
                <Button
                  key={id}
                  size="small"
                  variant={
                    !configError &&
                    config.projectUrl.replace(/\/$/, '') === projectUrl
                      ? 'primary'
                      : 'secondary'
                  }
                  disabled={busy || disabled}
                  testID={`prime-otp-use-${id}`}
                  onPress={() => updateConfig({ projectUrl, publicKey })}
                >
                  {label}
                </Button>
              ),
            )}
          </XStack>
          <IconButton
            icon="CrossedSmallOutline"
            size="small"
            variant="tertiary"
            ml="auto"
            flexShrink={0}
            accessibilityLabel="Close debug panel"
            aria-label="Close debug panel"
            testID="prime-otp-close-dev-controls"
            hotKey
            onPress={() => setClosedAtOpenCount(openCount)}
          />
        </XStack>
        <Input
          testID="prime-otp-supabase-url"
          placeholder="Supabase project URL"
          value={config.projectUrl}
          disabled={busy || disabled}
          autoCapitalize="none"
          onChangeText={(projectUrl) =>
            updateConfig({
              projectUrl: projectUrl.trim(),
              publicKey: getProjectPublicKey(projectUrl.trim()),
            })
          }
        />
        {isDirectSupabaseUrl(config.projectUrl) ? (
          <SizableText
            size="$bodySm"
            color="$textCaution"
            testID="prime-otp-supabase-proxy-warning"
          >
            Warning: Direct Supabase connection. Clients must route requests
            through OneKey servers for risk controls.
          </SizableText>
        ) : null}
        <XStack gap="$2" alignItems="center">
          <Switch
            testID="prime-otp-client-captcha"
            accessibilityLabel="Client CAPTCHA"
            value={config.captchaEnabled}
            disabled={busy || disabled}
            onChange={(captchaEnabled) => updateConfig({ captchaEnabled })}
          />
          <SizableText size="$bodySm">
            Client CAPTCHA:{' '}
            {config.captchaEnabled ? 'on' : 'off (legacy client)'}
          </SizableText>
        </XStack>
        <XStack gap="$2" alignItems="center">
          <Switch
            testID="prime-otp-password-login"
            accessibilityLabel="Password login"
            value={config.passwordLoginEnabled}
            disabled={busy || disabled}
            onChange={(passwordLoginEnabled) =>
              updateConfig({ passwordLoginEnabled })
            }
          />
          <SizableText size="$bodySm">Password login</SizableText>
        </XStack>
        <SizableText size="$bodySm">CAPTCHA page</SizableText>
        <XStack gap="$2" flexWrap="wrap">
          {CAPTCHA_PAGE_OPTIONS.map(({ id, label, url }) => (
            <Button
              key={id}
              size="small"
              variant={config.captchaPageUrl === url ? 'primary' : 'secondary'}
              disabled={busy || disabled}
              testID={`prime-otp-captcha-page-${id}`}
              onPress={() => updateConfig({ captchaPageUrl: url })}
            >
              {label}
            </Button>
          ))}
        </XStack>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          testID="prime-otp-captcha-page-url"
        >
          {config.captchaPageUrl}
        </SizableText>
        {configError ? (
          <SizableText size="$bodySm" color="$textCritical">
            {configError}
          </SizableText>
        ) : null}
        <PrimeResetPasswordTest
          email={email.trim()}
          captchaConfig={{
            enabled: config.captchaEnabled,
            pageUrl: config.captchaPageUrl,
          }}
          revision={revision}
          disabled={busy || authActionPending || !!configError}
          createClient={createIsolatedClient}
          onBusyChange={onResetBusyChange}
        />
      </Stack>
    ) : null;

  return {
    renderControls,
    captchaOverride: available
      ? {
          enabled: config.captchaEnabled,
          pageUrl: config.captchaPageUrl,
        }
      : undefined,
    sendCode,
    loginWithCode,
    loginWithPassword,
    isPasswordLogin,
    isTestProject,
    canSend: !available || (!busy && !configError),
    revision: available ? revision : 0,
  };
}
