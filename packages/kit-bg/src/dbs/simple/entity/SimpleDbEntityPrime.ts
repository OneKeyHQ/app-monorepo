import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import supabaseStorageInstance from '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance';
import { getSupabaseAuthSessionKey } from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';

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
    try {
      const sessionData = await supabaseStorageInstance.getItem(sessionKey);
      if (sessionData) {
        const session = JSON.parse(sessionData) as {
          access_token?: string;
        };
        const result = session?.access_token || '';
        return result || '';
      }
      return '';
    } catch {
      return '';
    }
  }

  // Note: Supabase storage instance automatically saves token when session is created/updated
  // No need to manually save token here
  @backgroundMethod()
  async saveAuthToken(_authToken: string) {
    // Supabase storage instance automatically saves token, no manual save needed
  }
}
