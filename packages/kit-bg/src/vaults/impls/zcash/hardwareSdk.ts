import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { zPrivacyHex } from '@onekeyhq/shared/src/utils/privacyTransactionReview';

import { ZCASH_PCZT_HEX_MAX_CHARS } from './transactionReview';

const addressSchema = z.object({
  path: z.string().min(1),
  address: z.string().min(1),
  seedFingerprint: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .nullish()
    .transform((value) => value ?? undefined),
});
const viewingKeySchema = z.object({
  path: z.string().min(1),
  ufvk: z.string().min(1),
});
const signedSchema = z.object({
  pczt: zPrivacyHex(ZCASH_PCZT_HEX_MAX_CHARS),
});
const responseSchema = z.object({ success: z.boolean(), payload: z.unknown() });
const errorSchema = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  error: z.string(),
  message: z.string().optional(),
  // Matches hd-core Unsuccessful.payload.params; non-object params are dropped.
  params: z.record(z.string(), z.unknown()).optional().catch(undefined),
  connectId: z.string().optional(),
  deviceId: z.string().optional(),
});

export type IZcashHardwareAddress = z.infer<typeof addressSchema>;
export type IZcashHardwareViewingKey = z.infer<typeof viewingKeySchema>;
type IResponse<T> =
  | { success: true; payload: T }
  | { success: false; payload: z.infer<typeof errorSchema> };
type IParams = Record<string, unknown>;
type IRawSdk = {
  zcashGetAddress: (
    connectId: string,
    deviceId: string,
    params: IParams,
  ) => Promise<unknown>;
  zcashGetFullViewingKey: (
    connectId: string,
    deviceId: string,
    params: IParams,
  ) => Promise<unknown>;
  zcashSignPczt: (
    connectId: string,
    deviceId: string,
    params: IParams,
  ) => Promise<unknown>;
};

const REQUIRED_METHODS = [
  'zcashGetAddress',
  'zcashGetFullViewingKey',
  'zcashSignPczt',
] as const;

function supportsZcash(sdk: unknown): sdk is IRawSdk {
  if (typeof sdk !== 'object' || sdk === null) return false;
  const methods = sdk as Record<string, unknown>;
  return REQUIRED_METHODS.every((name) => typeof methods[name] === 'function');
}

function parseResponse<T>(
  value: unknown,
  parsePayload: (payload: unknown) => T,
): IResponse<T> {
  const result = responseSchema.safeParse(value);
  if (!result.success)
    throw new OneKeyLocalError('zcash: malformed hardware response');
  if (!result.data.success) {
    const error = errorSchema.safeParse(result.data.payload);
    if (!error.success)
      throw new OneKeyLocalError('zcash: malformed hardware error');
    return { success: false, payload: error.data };
  }
  return { success: true, payload: parsePayload(result.data.payload) };
}

function parseAddress(value: unknown): IZcashHardwareAddress {
  const result = addressSchema.safeParse(value);
  if (!result.success)
    throw new OneKeyLocalError('zcash: malformed hardware address');
  return result.data;
}

// SDKs without these methods must fail before any device operation; every
// response is validated here.
export function getZcashHardwareSdk(sdk: unknown) {
  if (!supportsZcash(sdk)) {
    throw new OneKeyLocalError(
      'This app version does not support Zcash hardware accounts. Update the app before continuing.',
    );
  }
  const supportedSdk = sdk;
  function zcashGetAddress(
    connectId: string,
    deviceId: string,
    params: IParams & { bundle: IParams[] },
  ): Promise<IResponse<IZcashHardwareAddress[]>>;
  function zcashGetAddress(
    connectId: string,
    deviceId: string,
    params: IParams,
  ): Promise<IResponse<IZcashHardwareAddress>>;
  async function zcashGetAddress(
    connectId: string,
    deviceId: string,
    params: IParams,
  ): Promise<IResponse<IZcashHardwareAddress | IZcashHardwareAddress[]>> {
    const result = await supportedSdk.zcashGetAddress(
      connectId,
      deviceId,
      params,
    );
    return parseResponse(result, (value) => {
      if (Array.isArray(params.bundle)) {
        if (!Array.isArray(value))
          throw new OneKeyLocalError(
            'zcash: malformed hardware address bundle',
          );
        return value.map(parseAddress);
      }
      return parseAddress(value);
    });
  }
  // The device asks the user to confirm before it exports the UFVK.
  async function zcashGetFullViewingKey(
    connectId: string,
    deviceId: string,
    params: IParams,
  ): Promise<IResponse<IZcashHardwareViewingKey>> {
    const result = await supportedSdk.zcashGetFullViewingKey(
      connectId,
      deviceId,
      params,
    );
    return parseResponse(result, (value) => {
      const viewingKey = viewingKeySchema.safeParse(value);
      if (!viewingKey.success)
        throw new OneKeyLocalError('zcash: malformed hardware viewing key');
      return viewingKey.data;
    });
  }
  async function zcashSignPczt(
    connectId: string,
    deviceId: string,
    params: IParams,
  ) {
    const result = await supportedSdk.zcashSignPczt(
      connectId,
      deviceId,
      params,
    );
    return parseResponse(result, (value) => {
      const signed = signedSchema.safeParse(value);
      if (!signed.success)
        throw new OneKeyLocalError('zcash: malformed signed hardware PCZT');
      return signed.data;
    });
  }
  return { zcashGetAddress, zcashGetFullViewingKey, zcashSignPczt };
}
