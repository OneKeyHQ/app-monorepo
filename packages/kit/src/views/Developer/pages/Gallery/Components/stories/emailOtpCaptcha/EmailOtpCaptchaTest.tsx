import { useCallback, useEffect, useRef, useState } from 'react';

import { createClient } from '@supabase/supabase-js';

import {
  Button,
  Input,
  SizableText,
  Stack,
  Switch,
  Toast,
  XStack,
} from '@onekeyhq/components';
import CaptchaFrame from '@onekeyhq/kit/src/components/Captcha/CaptchaFrame';
import type { ICaptchaMessage } from '@onekeyhq/kit/src/components/Captcha/captchaMessage';
import { EMAIL_OTP_TEST_CONFIG } from '@onekeyhq/kit/src/components/Captcha/dev/emailOtpTestConfig';
import { SUPABASE_PROJECT_URL } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

export default function EmailOtpCaptchaTest() {
  const [projectUrl, setProjectUrl] = useState(
    EMAIL_OTP_TEST_CONFIG.projectUrl,
  );
  const { publicKey, pageUrl } = EMAIL_OTP_TEST_CONFIG;
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [challenge, setChallenge] = useState<{
    url: string;
    requestId: string;
  }>();
  const [captchaToken, setCaptchaToken] = useState('');
  const [status, setStatus] = useState('Isolated test project configured.');
  const [busy, setBusy] = useState(false);
  const [clientCaptchaEnabled, setClientCaptchaEnabled] = useState(true);
  const [requestSummary, setRequestSummary] = useState('');
  const actionInProgress = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setCaptchaToken('');
    setChallenge(undefined);
    setOtp('');
    setRequestSummary('');
  }, [projectUrl, publicKey, pageUrl, email]);

  useEffect(() => {
    if (!captchaToken) return undefined;
    // Expire locally before Turnstile's five-minute server deadline.
    const timer = setTimeout(() => {
      setCaptchaToken('');
      setStatus('CAPTCHA expired. Start a new challenge.');
    }, 240_000);
    return () => clearTimeout(timer);
  }, [captchaToken]);

  const onResult = useCallback((message: ICaptchaMessage) => {
    if (message.status === 'ready') return;
    setCaptchaToken(message.status === 'success' ? message.token || '' : '');
    setStatus(`CAPTCHA ${message.status}`);
  }, []);

  const createTestClient = () => {
    const url = new URL(projectUrl.trim());
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.supabase.co') ||
      url.origin === new URL(SUPABASE_PROJECT_URL).origin ||
      url.origin !== EMAIL_OTP_TEST_CONFIG.projectUrl ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      url.port ||
      !publicKey.trim().startsWith('sb_publishable_')
    ) {
      throw new OneKeyLocalError('Invalid test configuration');
    }
    // This sandbox never reads or writes the app's main/bg auth storage.
    return createClient(url.origin, publicKey.trim(), {
      auth: {
        flowType: 'pkce',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `email-otp-captcha-test-${generateUUID()}`,
      },
    });
  };

  const sendCode = async (captchaMode: 'valid' | 'missing' | 'invalid') => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setBusy(true);
    let token: string | undefined;
    if (captchaMode === 'valid') token = captchaToken;
    if (captchaMode === 'invalid') token = 'invalid-captcha-test-token';
    setCaptchaToken('');
    setStatus('Sending OTP request to Supabase.');
    setRequestSummary(
      `POST /auth/v1/otp — CAPTCHA token ${token ? 'included' : 'omitted'}`,
    );
    try {
      const client = createTestClient();
      const { data, error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          ...(token ? { captchaToken: token } : {}),
        },
      });
      if (!mounted.current) return;
      if (error) {
        setStatus(error.message);
        Toast.error({ title: error.message });
        setRequestSummary(
          `POST /auth/v1/otp — CAPTCHA token ${token ? 'included' : 'omitted'} — HTTP ${error.status} — session ${data.session ? 'returned' : 'not returned'}`,
        );
      } else {
        setStatus('Auth email request accepted. Check your email template.');
      }
    } catch {
      if (mounted.current)
        setStatus('Request failed. Check configuration/network.');
    } finally {
      actionInProgress.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setBusy(true);
    try {
      const client = createTestClient();
      const { data, error } = await client.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });
      if (!mounted.current) return;
      if (error || !data.session) {
        setStatus(`OTP rejected: ${error?.code || 'no_session'}`);
        return;
      }
      const result = await client.auth.getUser(data.session.access_token);
      if (mounted.current) {
        setOtp('');
        setStatus(
          !result.error && result.data.user?.id === data.session.user.id
            ? 'PASS: OTP verified and Supabase user authenticated.'
            : 'FAIL: session user verification failed.',
        );
      }
    } catch {
      if (mounted.current)
        setStatus('Verification failed. Check configuration/network.');
    } finally {
      actionInProgress.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Stack gap="$3" testID="email-otp-captcha-test">
      <SizableText>
        Isolated Supabase test with a real Turnstile widget. Sessions stay in
        memory.
      </SizableText>
      <Input
        testID="otp-test-project-url"
        placeholder="Test Supabase project URL"
        value={projectUrl}
        onChangeText={setProjectUrl}
        autoCapitalize="none"
        disabled={busy}
      />
      <Input
        testID="otp-test-email"
        placeholder="Test recipient email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        disabled={busy}
      />
      <XStack gap="$3" alignItems="center">
        <Switch
          testID="otp-test-client-captcha-enabled"
          accessibilityLabel="Client CAPTCHA"
          value={clientCaptchaEnabled}
          disabled={busy}
          onChange={(enabled) => {
            setClientCaptchaEnabled(enabled);
            setCaptchaToken('');
            setChallenge(undefined);
            setOtp('');
            setRequestSummary('');
            setStatus(
              enabled
                ? 'CAPTCHA enabled. Start a new challenge.'
                : 'Legacy client mode. Send OTP to test server enforcement.',
            );
          }}
        />
        <SizableText>
          {clientCaptchaEnabled
            ? 'Client CAPTCHA: on'
            : 'Client CAPTCHA: off (legacy client)'}
        </SizableText>
      </XStack>
      <SizableText size="$bodySm" color="$textSubdued">
        Turning this off unloads CAPTCHA and omits its token from the normal
        send request. Supabase protection stays enabled. Existing valid OTPs and
        sessions are not invalidated by this switch.
      </SizableText>
      <Button
        testID="otp-test-start-captcha"
        disabled={busy || !clientCaptchaEnabled}
        onPress={() => {
          setCaptchaToken('');
          try {
            const url = new URL(pageUrl);
            if (!['https:', 'http:'].includes(url.protocol)) return;
            const requestId = generateUUID();
            url.hash = new URLSearchParams({ requestId }).toString();
            setChallenge({ url: url.toString(), requestId });
            setStatus('Waiting for CAPTCHA.');
          } catch {
            setStatus('Unable to start CAPTCHA.');
          }
        }}
      >
        Start / reset CAPTCHA
      </Button>
      {clientCaptchaEnabled && challenge ? (
        <CaptchaFrame
          key={challenge.requestId}
          {...challenge}
          onResult={onResult}
        />
      ) : null}
      <Button
        testID="otp-test-send"
        disabled={busy || (clientCaptchaEnabled && !captchaToken) || !email}
        onPress={() => sendCode(clientCaptchaEnabled ? 'valid' : 'missing')}
      >
        {clientCaptchaEnabled
          ? 'Send OTP with CAPTCHA'
          : 'Send OTP without CAPTCHA'}
      </Button>
      <Button
        testID="otp-test-send-without-captcha"
        disabled={busy || !email}
        onPress={() => sendCode('missing')}
      >
        Negative test: send without CAPTCHA
      </Button>
      <Button
        testID="otp-test-send-invalid-captcha"
        disabled={busy || !email}
        onPress={() => sendCode('invalid')}
      >
        Negative test: send invalid CAPTCHA
      </Button>
      <Input
        testID="otp-test-code"
        placeholder="Email OTP"
        value={otp}
        onChangeText={setOtp}
        autoCapitalize="none"
        disabled={busy}
      />
      <Button
        testID="otp-test-verify"
        disabled={busy || !otp || !email}
        onPress={verifyCode}
      >
        Verify OTP and session
      </Button>
      <SizableText testID="otp-test-status">{status}</SizableText>
      <SizableText testID="otp-test-request-summary" size="$bodySm">
        {requestSummary}
      </SizableText>
    </Stack>
  );
}
