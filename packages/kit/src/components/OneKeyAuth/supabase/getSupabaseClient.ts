// https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth?queryGroups=auth-store&auth-store=async-storage
import { createClient } from '@supabase/supabase-js';

import supabaseStorageInstance from '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance';
import {
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';

import type { SupabaseClient } from '@supabase/supabase-js';

// do not add this on web env
// import 'react-native-url-polyfill/auto'; // TODO move to shared polyfill

let client: SupabaseClient | undefined;
const storage = supabaseStorageInstance;

export function getSupabaseClient() {
  if (!client) {
    client = createClient(
      SUPABASE_PROJECT_URL ?? '',
      SUPABASE_PUBLIC_API_KEY ?? '',
      {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return { client, storage };
}
