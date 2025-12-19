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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
    signInWithGoogle,
    signInWithApple,
    signInWithOtp,
    verifyOtp,
    getSession,
    getUser,
    refreshSession,
    isLoggedIn: isSupabaseLoggedIn,
    isReady,
  } = useSupabaseAuth();

  const { logout } = useOneKeyAuth();

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
              const result = await signInWithGoogle({ persistSession });
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
              demoLog(result, 'signInWithGoogle');
            } catch (e) {
              demoError(e, 'signInWithGoogle');
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
              const result = await signInWithApple({ persistSession });
              if (result.success) {
                Toast.success({
                  title: 'Apple Sign In Success',
                  message: 'You are now signed in with Apple',
                });
              }
              demoLog(result, 'signInWithApple');
            } catch (e) {
              demoError(e, 'signInWithApple');
            } finally {
              setLoading(null);
            }
          }}
        >
          Sign In with Apple
        </Button>
      </XStack>

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
