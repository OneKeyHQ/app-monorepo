import { useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  Stack,
  Toast,
} from '@onekeyhq/components';
import { useSupabaseAuthContext } from '@onekeyhq/kit/src/components/OneKeyAuth/supabase/SupabaseAuthContext';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { Layout } from './utils/Layout';

function demoLog(data: any, apiName: string) {
  Dialog.debugMessage({
    title: `API Response: ${apiName}`,
    debugMessage: data,
  });
  Toast.success({
    title: `${apiName} Success`,
    message: 'Check debug dialog for full response',
  });
  if (!platformEnv.isNative) {
    console.log('Hyperliquid API Response:', data);
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
    console.error('Hyperliquid API Error:', error);
  }
}

export function AuthApiTests() {
  const {
    user,
    supabaseUser,
    supabaseSignOut,
    supabaseSignInWithOtp,
    supabaseVerifyOtp,
    getSupabaseClient,
  } = useOneKeyAuth();
  const supabaseContext = useSupabaseAuthContext();

  const lastOneKeyIdLoginEmail = appStorage.syncStorage.getString(
    EAppSyncStorageKeys.last_onekey_id_login_email,
  );

  const [email, setEmail] = useState(lastOneKeyIdLoginEmail || '');
  const [otp, setOtp] = useState('');
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [storageKey, setStorageKey] = useState('test13477193465');
  const [storageValue, setStorageValue] = useState('test');

  useEffect(() => {
    appStorage.syncStorage.set(
      EAppSyncStorageKeys.last_onekey_id_login_email,
      email,
    );
  }, [email]);

  return (
    <Stack gap="$4">
      <Stack gap="$3">
        {supabaseContext?.isLoggedIn ? (
          <SizableText>
            已登录: {supabaseContext?.session?.user?.email}
          </SizableText>
        ) : null}
        <Input
          placeholder="email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <Input placeholder="otp" value={otp} onChangeText={setOtp} />
        <Button
          onPress={() => {
            demoLog(supabaseContext, 'show auth context data');
          }}
        >
          show auth context data
        </Button>
        <Button
          onPress={() => {
            demoLog(supabaseUser, 'show supabase user data');
          }}
        >
          show supabase user data
        </Button>
        <Button
          onPress={() => {
            demoLog(user, 'show user data');
          }}
        >
          show OneKey user data
        </Button>
        <Button
          loading={signOutLoading}
          disabled={signOutLoading}
          onPress={async () => {
            try {
              setSignOutLoading(true);
              const res = await supabaseSignOut();
              demoLog(res, 'sign out');
            } catch (e) {
              demoError(e, 'sign out');
            } finally {
              setSignOutLoading(false);
            }
          }}
        >
          sign out
        </Button>
        <Button
          loading={signInLoading}
          disabled={!email || signInLoading}
          onPress={async () => {
            try {
              setSignInLoading(true);
              const res = await supabaseSignInWithOtp({ email });
              demoLog(res, 'sign in with otp');
            } catch (e) {
              demoError(e, 'sign in with otp');
            } finally {
              setSignInLoading(false);
            }
          }}
        >
          Sign in Step 1(send otp)
        </Button>
        <Button
          loading={verifyLoading}
          onPress={async () => {
            try {
              setVerifyLoading(true);
              const res = await supabaseVerifyOtp({ email, otp });
              demoLog(res, 'verify otp');
            } catch (e) {
              demoError(e, 'verify otp');
            } finally {
              setVerifyLoading(false);
            }
          }}
        >
          Sign in Step 2(verify otp)
        </Button>
        <Button
          onPress={async () => {
            demoLog(
              await getSupabaseClient().client.auth.getUser(),
              'get supabase client',
            );
          }}
        >
          get user
        </Button>
        <SizableText size="$headingMd" mt="$4">
          Storage Tests
        </SizableText>
        <Input
          placeholder="storage key"
          value={storageKey}
          onChangeText={setStorageKey}
        />
        <Input
          placeholder="storage value"
          value={storageValue}
          onChangeText={setStorageValue}
        />
        <Button
          onPress={async () => {
            try {
              const result = await getSupabaseClient().storage?.setItem(
                storageKey,
                storageValue,
              );
              demoLog(result, 'storage set item');
            } catch (e) {
              demoError(e, 'storage set item');
            }
          }}
        >
          storage set item (write)
        </Button>
        <Button
          onPress={async () => {
            try {
              const result = await getSupabaseClient().storage?.getItem(
                storageKey,
              );
              demoLog(result, 'storage get item');
            } catch (e) {
              demoError(e, 'storage get item');
            }
          }}
        >
          storage get item (read)
        </Button>
        <Button
          onPress={async () => {
            try {
              const result = await getSupabaseClient().storage?.removeItem(
                storageKey,
              );
              demoLog(result, 'storage remove item');
            } catch (e) {
              demoError(e, 'storage remove item');
            }
          }}
        >
          storage remove item (delete)
        </Button>
        <Button
          onPress={async () => {
            try {
              const result = await getSupabaseClient().storage?.getAllKeys();
              demoLog(result, 'storage get all keys');
            } catch (e) {
              demoError(e, 'storage get all keys');
            }
          }}
        >
          storage get all keys
        </Button>
        <Button
          onPress={async () => {
            try {
              await getSupabaseClient().storage?.clear();
              demoLog('cleared', 'storage clear');
            } catch (e) {
              demoError(e, 'storage clear');
            }
          }}
        >
          clear storage
        </Button>
      </Stack>
    </Stack>
  );
}

const AuthGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="AuthGallery"
    elements={[
      {
        title: 'Auth API Test',
        element: <AuthApiTests />,
      },
    ]}
  />
);

export default AuthGallery;
