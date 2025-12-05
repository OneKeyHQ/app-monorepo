// https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth?queryGroups=auth-store&auth-store=async-storage
import { createClient } from '@supabase/supabase-js';

import { SUPABASE_PROJECT_URL, SUPABASE_PUBLIC_API_KEY } from './consts';
import { SupabaseStorage } from './SupabaseStorage';

import type { SupabaseClient } from '@supabase/supabase-js';

// do not add this on web env
// import 'react-native-url-polyfill/auto'; // TODO move to shared polyfill

let client: SupabaseClient | undefined;
let storage: SupabaseStorage | undefined;

export function getSupabaseClient() {
  if (!client) {
    storage = new SupabaseStorage();
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
