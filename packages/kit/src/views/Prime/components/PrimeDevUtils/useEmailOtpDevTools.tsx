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
  EMAIL_OTP_TEST_CONFIG,
  EMAIL_OTP_TEST_PROJECTS,
} from '@onekeyhq/kit/src/components/Captcha/dev/emailOtpTestConfig';
import { requestEmailOtp } from '@onekeyhq/kit/src/components/OneKeyAuth/supabase/requestEmailOtp';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

type IDevConfig = {
  projectUrl: string;
  publicKey: string;
  captchaEnabled: boolean;
  captchaPageUrl: string;
};

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
  { id: 'local', label: 'Local', url: EMAIL_OTP_CAPTCHA_PAGE_URLS.local },
  { id: 'test', label: 'Test', url: EMAIL_OTP_CAPTCHA_PAGE_URLS.test },
  {
    id: 'production',
    label: 'Production',
    url: EMAIL_OTP_CAPTCHA_PAGE_URLS.production,
  },
];

function isProductionProject(projectUrl: string): boolean {
  try {
    return new URL(projectUrl).origin === SUPABASE_PROJECT_URL;
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
    const { origin } = new URL(projectUrl);
    return (
      SUPABASE_PROJECT_OPTIONS.find((project) => project.projectUrl === origin)
        ?.publicKey ?? ''
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
      !url.hostname.endsWith('.supabase.co') ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      url.port
    ) {
      return 'Enter a hosted Supabase HTTPS project URL.';
    }
    if (!config.publicKey.startsWith('sb_publishable_')) {
      return 'Select a configured Supabase project.';
    }
  } catch {
    return 'Enter a valid Supabase project URL.';
  }
  return undefined;
}

export function useEmailOtpDevTools({
  openCount,
  sendCode: originalSendCode,
  loginWithCode: originalLoginWithCode,
}: {
  openCount: number;
  sendCode: (args: { email: string; captchaToken?: string }) => Promise<void>;
  loginWithCode: (args: { email: string; code: string }) => Promise<void>;
}) {
  const [devSettings] = useDevSettingsPersistAtom();
  const available = devSettings.enabled && openCount > 0;
  const intl = useIntl();
  const mounted = useIsMounted();
  const [config, setConfig] = useState<IDevConfig>({
    projectUrl: SUPABASE_PROJECT_URL,
    publicKey: SUPABASE_PUBLIC_API_KEY,
    captchaEnabled: false,
    captchaPageUrl: EMAIL_OTP_TEST_CONFIG.pageUrl,
  });
  const [revision, setRevision] = useState(0);
  const [closedAtOpenCount, setClosedAtOpenCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const isTestProject = available && !isProductionProject(config.projectUrl);
  const configError = available ? getConfigError(config) : undefined;

  const updateConfig = (patch: Partial<IDevConfig>) => {
    if (busyRef.current) return;
    const next = { ...config, ...patch };
    setConfig(next);
    setRevision((current) => current + 1);
  };

  const createTestClient = useCallback(() => {
    if (!available || !isTestProject || getConfigError(config)) {
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
  }, [available, config, isTestProject]);

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
            client: createTestClient(),
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
      createTestClient,
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
        const client = createTestClient();
        const { data, error } = await client.auth.verifyOtp({
          email: args.email,
          token: args.code,
          type: 'email',
        });
        if (error) throw error;
        if (!data.session)
          throw new OneKeyLocalError('Test Supabase returned no session.');
        const user = await client.auth.getUser(data.session.access_token);
        if (user.error || user.data.user?.id !== data.session.user.id) {
          throw new OneKeyLocalError(
            'Test Supabase session verification failed.',
          );
        }
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [createTestClient, isTestProject, mounted, originalLoginWithCode],
  );

  const renderControls = (disabled = false) =>
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
    isTestProject,
    canSend: !available || (!busy && !configError),
    revision: available ? revision : 0,
  };
}
