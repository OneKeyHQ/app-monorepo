import { useState } from 'react';

import {
  Button,
  Dialog,
  Icon,
  Input,
  ScrollView,
  SizableText,
  Stack,
  Switch,
  TextArea,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSupabaseAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/supabase/useSupabaseAuth';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { JuiceboxClient } from '@onekeyhq/kit-bg/src/services/ServiceKeylessWallet/utils/JuiceboxClient';
import {
  EOAuthSocialLoginProvider,
  GOOGLE_OAUTH_CLIENT_IDS,
  KEYLESS_SUPABASE_PROJECT_URL,
  KEYLESS_SUPABASE_PUBLIC_API_KEY,
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { Layout } from './utils/Layout';

function demoLog(data: unknown, apiName: string) {
  Dialog.debugMessage({
    title: `API Response: ${apiName}`,
    debugMessage: data,
  });
  Toast.success({
    title: `${apiName} Success`,
    message: 'Check debug dialog for full response',
  });
  if (!platformEnv.isNative) {
    console.log('OneKeyID API Response:', data);
  }
}

function demoError(error: unknown, apiName: string) {
  const e = error as Error;
  Dialog.debugMessage({
    title: `API Error: ${apiName}`,
    debugMessage: error,
  });
  Toast.error({
    title: 'API Error',
    message: e?.message || 'Unknown error',
  });
  if (!platformEnv.isNative) {
    console.error('OneKeyID API Error:', error);
  }
}

function OneKeyIDApiTests() {
  const navigation = useAppNavigation();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [persistSession, setPersistSession] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [decodedToken, setDecodedToken] = useState<Record<
    string,
    unknown
  > | null>(null);

  const {
    signInWithOtp,
    verifyOtp,
    getSession,
    getUser,
    refreshSession,
    isLoggedIn: isSupabaseLoggedIn,
    isReady,
  } = useSupabaseAuth();

  const { logout, signInWithSocialLogin } = useOneKeyAuth();

  const onTryCloseWindow = async () => {
    if (platformEnv.isNative) {
      Toast.error({
        title: 'Not supported',
        message: 'window.close() is not available on native.',
      });
      return;
    }
    try {
      const beforeClosed = globalThis.window?.closed;
      globalThis.window?.close();
      const afterClosed = globalThis.window?.closed;
      Dialog.debugMessage({
        title: 'window.close() result',
        debugMessage: {
          beforeClosed,
          afterClosed,
          note: 'Most browsers only allow window.close() for windows opened by script (window.open).',
        },
      });
    } catch (e) {
      Dialog.debugMessage({
        title: 'window.close() threw',
        debugMessage: e,
      });
    }
  };

  return (
    <YStack gap="$4">
      <SizableText size="$headingMd">Supabase Status</SizableText>
      <XStack gap="$4" alignItems="center">
        <XStack gap="$2" alignItems="center">
          <Icon
            name={isReady ? 'CheckmarkSolid' : 'XCircleSolid'}
            color={isReady ? '$iconSuccess' : '$iconCritical'}
            size="$5"
          />
          <SizableText>Ready</SizableText>
        </XStack>
        <XStack gap="$2" alignItems="center">
          <Icon
            name={isSupabaseLoggedIn ? 'CheckmarkSolid' : 'XCircleSolid'}
            color={isSupabaseLoggedIn ? '$iconSuccess' : '$iconCritical'}
            size="$5"
          />
          <SizableText>Logged In</SizableText>
        </XStack>
      </XStack>

      <SizableText size="$headingMd" mt="$2">
        Supabase Config (Debug)
      </SizableText>
      <YStack
        gap="$2"
        padding="$3"
        backgroundColor="$bgSubdued"
        borderRadius="$2"
      >
        <XStack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            SUPABASE_PROJECT_URL:
          </SizableText>
          <SizableText size="$bodySm" style={{ wordBreak: 'break-all' }}>
            {SUPABASE_PROJECT_URL || '(empty)'}
          </SizableText>
        </XStack>
        <XStack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            SUPABASE_PUBLIC_API_KEY:
          </SizableText>
          <SizableText size="$bodySm" style={{ wordBreak: 'break-all' }}>
            {SUPABASE_PUBLIC_API_KEY || '(empty)'}
          </SizableText>
        </XStack>
        <XStack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            KEYLESS_SUPABASE_PROJECT_URL:
          </SizableText>
          <SizableText size="$bodySm" style={{ wordBreak: 'break-all' }}>
            {KEYLESS_SUPABASE_PROJECT_URL || '(empty)'}
          </SizableText>
        </XStack>
        <XStack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            KEYLESS_SUPABASE_PUBLIC_API_KEY:
          </SizableText>
          <SizableText size="$bodySm" style={{ wordBreak: 'break-all' }}>
            {KEYLESS_SUPABASE_PUBLIC_API_KEY || '(empty)'}
          </SizableText>
        </XStack>
        <XStack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            GOOGLE_OAUTH_CLIENT_WEB:
          </SizableText>
          <SizableText size="$bodySm" style={{ wordBreak: 'break-all' }}>
            {GOOGLE_OAUTH_CLIENT_IDS.WEB || '(empty)'}
          </SizableText>
        </XStack>
        <XStack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            GOOGLE_OAUTH_CLIENT_IOS:
          </SizableText>
          <SizableText size="$bodySm" style={{ wordBreak: 'break-all' }}>
            {GOOGLE_OAUTH_CLIENT_IDS.IOS || '(empty)'}
          </SizableText>
        </XStack>
      </YStack>

      <SizableText size="$headingMd" mt="$2">
        OAuth Sign In
      </SizableText>

      <XStack gap="$3" alignItems="center" mb="$2">
        <Switch value={persistSession} onChange={setPersistSession} />
        <SizableText size="$bodyMd">
          Persist Session (save to storage)
        </SizableText>
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        <Button
          loading={loading === 'google'}
          disabled={loading !== null}
          onPress={async () => {
            try {
              setLoading('google');
              const result = await signInWithSocialLogin(
                EOAuthSocialLoginProvider.Google,
                { persistSession },
              );
              if (result.success && result.session?.accessToken) {
                // Set access token
                setAccessToken(result.session.accessToken);
                // Decode JWT token
                const decoded = stringUtils.decodeJWT(
                  result.session.accessToken,
                );
                setDecodedToken(decoded);
                Toast.success({
                  title: 'Google Sign In Success',
                  message: 'You are now signed in with Google',
                });
              }
              demoLog(result, 'signInWithSocialLogin(Google)');
            } catch (e) {
              demoError(e, 'signInWithSocialLogin(Google)');
            } finally {
              setLoading(null);
            }
          }}
        >
          Sign In with Google
        </Button>

        <Button
          loading={loading === 'apple'}
          disabled={loading !== null}
          onPress={async () => {
            try {
              setLoading('apple');
              const result = await signInWithSocialLogin(
                EOAuthSocialLoginProvider.Apple,
                { persistSession },
              );
              if (result.success && result.session?.accessToken) {
                // Set access token
                setAccessToken(result.session.accessToken);
                // Decode JWT token
                const decoded = stringUtils.decodeJWT(
                  result.session.accessToken,
                );
                setDecodedToken(decoded);
                Toast.success({
                  title: 'Apple Sign In Success',
                  message: 'You are now signed in with Apple',
                });
              }
              demoLog(result, 'signInWithSocialLogin(Apple)');
            } catch (e) {
              demoError(e, 'signInWithSocialLogin(Apple)');
            } finally {
              setLoading(null);
            }
          }}
        >
          Sign In with Apple
        </Button>
      </XStack>

      {!platformEnv.isNative ? (
        <XStack gap="$3" flexWrap="wrap">
          <Button onPress={onTryCloseWindow}>Try window.close()</Button>
        </XStack>
      ) : null}

      <SizableText size="$headingMd" mt="$4">
        Email OTP Sign In
      </SizableText>

      <Stack gap="$3">
        <Input
          placeholder="Enter email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Button
          loading={loading === 'sendOtp'}
          disabled={loading !== null || !email}
          onPress={async () => {
            try {
              setLoading('sendOtp');
              const result = await signInWithOtp({ email });
              demoLog(result, 'signInWithOtp');
            } catch (e) {
              demoError(e, 'signInWithOtp');
            } finally {
              setLoading(null);
            }
          }}
        >
          Send OTP to Email
        </Button>

        <Input
          placeholder="Enter OTP code"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
        />

        <Button
          loading={loading === 'verifyOtp'}
          disabled={loading !== null || !email || !otp}
          onPress={async () => {
            try {
              setLoading('verifyOtp');
              const result = await verifyOtp({ email, otp });
              demoLog(result, 'verifyOtp');

              // After successful verification, login to Prime service
              if (result.data?.session?.access_token) {
                await backgroundApiProxy.servicePrime.apiLogin({
                  accessToken: result.data.session.access_token,
                });
                Toast.success({
                  title: 'Logged in to Prime service',
                });
              }
            } catch (e) {
              demoError(e, 'verifyOtp');
            } finally {
              setLoading(null);
            }
          }}
        >
          Verify OTP
        </Button>
      </Stack>

      <Stack gap="$2" mt="$4">
        <SizableText size="$headingMd">Access Token</SizableText>
        <TextArea
          value={accessToken}
          onChangeText={(text) => {
            setAccessToken(text);
            // Re-decode JWT token when user changes the textarea content
            if (text.trim()) {
              const decoded = stringUtils.decodeJWT(text.trim());
              setDecodedToken(decoded);
            } else {
              setDecodedToken(null);
            }
          }}
          placeholder="Access token will appear here after login"
          numberOfLines={4}
        />
      </Stack>

      {decodedToken !== null ? (
        <Stack gap="$2" mt="$4">
          <SizableText size="$headingMd">Decoded Access Token</SizableText>
          {decodedToken.iat && typeof decodedToken.iat === 'number' ? (
            <XStack gap="$2" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                Issued at:
              </SizableText>
              <SizableText size="$bodyMd">
                {formatDate(new Date(decodedToken.iat * 1000))}
              </SizableText>
            </XStack>
          ) : null}
          {decodedToken.exp && typeof decodedToken.exp === 'number' ? (
            <XStack gap="$2" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                Expires at:
              </SizableText>
              <SizableText size="$bodyMd">
                {formatDate(new Date(decodedToken.exp * 1000))}
              </SizableText>
            </XStack>
          ) : null}
          <ScrollView
            maxHeight={300}
            borderWidth={1}
            borderColor="$borderSubdued"
            borderRadius="$2"
            padding="$3"
            backgroundColor="$bgSubdued"
          >
            <SizableText
              size="$bodySm"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
            >
              {JSON.stringify(decodedToken, null, 2)}
            </SizableText>
          </ScrollView>
        </Stack>
      ) : null}

      <SizableText size="$headingMd" mt="$4">
        Session Management
      </SizableText>

      <XStack gap="$3" flexWrap="wrap">
        <Button
          loading={loading === 'getSession'}
          disabled={loading !== null}
          onPress={async () => {
            try {
              setLoading('getSession');
              const result = await getSession();
              demoLog(result, 'getSession');
            } catch (e) {
              demoError(e, 'getSession');
            } finally {
              setLoading(null);
            }
          }}
        >
          Get Session
        </Button>

        <Button
          loading={loading === 'getUser'}
          disabled={loading !== null}
          onPress={async () => {
            try {
              setLoading('getUser');
              const result = await getUser();
              demoLog(result, 'getUser');
            } catch (e) {
              demoError(e, 'getUser');
            } finally {
              setLoading(null);
            }
          }}
        >
          Get User
        </Button>

        <Button
          loading={loading === 'isLoggedIn'}
          disabled={loading !== null}
          onPress={async () => {
            try {
              setLoading('isLoggedIn');
              const result = await backgroundApiProxy.servicePrime.isLoggedIn();
              demoLog({ isLoggedIn: result }, 'isLoggedIn (Prime)');
            } catch (e) {
              demoError(e, 'isLoggedIn');
            } finally {
              setLoading(null);
            }
          }}
        >
          Check Prime Login Status
        </Button>

        <Button
          loading={loading === 'getLocalUserInfo'}
          disabled={loading !== null}
          onPress={async () => {
            try {
              setLoading('getLocalUserInfo');
              const result =
                await backgroundApiProxy.servicePrime.getLocalUserInfo();
              demoLog(result, 'getLocalUserInfo');
            } catch (e) {
              demoError(e, 'getLocalUserInfo');
            } finally {
              setLoading(null);
            }
          }}
        >
          Get Local User Info
        </Button>

        <Button
          loading={loading === 'refreshSession'}
          disabled={loading !== null}
          onPress={async () => {
            try {
              setLoading('refreshSession');
              const result = await refreshSession();
              demoLog(result, 'refreshSession');
            } catch (e) {
              demoError(e, 'refreshSession');
            } finally {
              setLoading(null);
            }
          }}
        >
          Refresh Session
        </Button>
      </XStack>

      <SizableText size="$headingMd" mt="$4">
        Juicebox Test
      </SizableText>
      <XStack gap="$3" flexWrap="wrap">
        <Button
          onPress={async () => {
            try {
              setLoading('juiceboxExchange');
              const juicebox = new JuiceboxClient();
              await juicebox.exchangeToken(accessToken);
              demoLog({ success: true }, 'Juicebox exchangeToken');
            } catch (e) {
              demoError(e, 'Juicebox exchangeToken');
            } finally {
              setLoading(null);
            }
          }}
        >
          Juicebox exchangeToken
        </Button>
        <Button
          loading={loading === 'juiceboxRegister'}
          disabled={loading !== null || !accessToken}
          onPress={async () => {
            try {
              setLoading('juiceboxRegister');
              const juicebox = new JuiceboxClient();
              await juicebox.exchangeToken(accessToken);
              await juicebox.register({
                pin: '123456',
                secret: 'YXNkZg==', // asdf in base64
                userInfo: 'test-user',
              });
              demoLog({ success: true }, 'Juicebox register');
            } catch (e) {
              demoError(e, 'Juicebox register');
            } finally {
              setLoading(null);
            }
          }}
        >
          Juicebox Register
        </Button>
        <Button
          loading={loading === 'juiceboxRecover'}
          disabled={loading !== null || !accessToken}
          onPress={async () => {
            try {
              setLoading('juiceboxRecover');
              const juicebox = new JuiceboxClient();
              await juicebox.exchangeToken(accessToken);
              const secret = await juicebox.recover({
                pin: '123456',
                userInfo: 'test-user',
              });
              demoLog({ secret }, 'Juicebox recover');
            } catch (e) {
              demoError(e, 'Juicebox recover');
            } finally {
              setLoading(null);
            }
          }}
        >
          Juicebox Recover
        </Button>
      </XStack>

      <Button
        loading={loading === 'signOut'}
        disabled={loading !== null}
        variant="destructive"
        onPress={async () => {
          try {
            setLoading('signOut');
            // Sign out from both Supabase and Prime service
            await logout();
            demoLog({ success: true }, 'logout');
          } catch (e) {
            demoError(e, 'logout');
          } finally {
            setLoading(null);
          }
        }}
      >
        Sign Out
      </Button>

      <SizableText size="$headingMd" mt="$4">
        Onboarding Test
      </SizableText>
      <XStack gap="$3" flexWrap="wrap">
        <Button
          onPress={() => {
            navigation.navigate(ERootRoutes.Onboarding, {
              screen: EOnboardingV2Routes.OnboardingV2,
              params: {
                screen: EOnboardingPagesV2.CreatePasscode,
              },
            });
          }}
        >
          Go to CreatePasscodePage
        </Button>
      </XStack>
    </YStack>
  );
}

const OneKeyIDGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="OneKeyIDGallery"
    elements={[
      {
        title: 'OneKey ID Authentication Test',
        element: <OneKeyIDApiTests />,
      },
    ]}
  />
);

export default OneKeyIDGallery;
