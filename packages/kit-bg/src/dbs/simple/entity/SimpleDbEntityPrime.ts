import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import supabaseStorageInstance from '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance';
import { getSupabaseAuthSessionKey } from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';
import { getSupabaseClient } from '@onekeyhq/shared/src/utils/supabaseClientUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDBPrime {
  authToken: string;
}

export class SimpleDbEntityPrime extends SimpleDbEntityBase<ISimpleDBPrime> {
  entityName = 'prime';

  override enableCache = true;

  // Get token from supabase storage instance
  // Supabase automatically stores session with key: sb-<project-ref>-auth-token
  // The key is generated from SUPABASE_PROJECT_URL using getSupabaseAuthSessionKey()
  @backgroundMethod()
  async getAuthToken(): Promise<string> {
    const sessionKey = getSupabaseAuthSessionKey();
    if (!sessionKey) {
      throw new OneKeyLocalError('Supabase auth session key not found');
    }
    const session = await getSupabaseClient().client.auth.getSession();
    return session.data.session?.access_token || '';
  }

  // Note: Supabase storage instance automatically saves token when session is created/updated
  // No need to manually save token here
  @backgroundMethod()
  async saveAuthToken(_authToken: string) {
    supabaseStorageInstance.getItemWithCache.clear();
    // Supabase storage instance automatically saves token, no manual save needed
  }
}
