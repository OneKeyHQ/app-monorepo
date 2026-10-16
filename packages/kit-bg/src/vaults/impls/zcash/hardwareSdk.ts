import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { zPrivacyHex } from '@onekeyhq/shared/src/utils/privacyTransactionReview';

const addressSchema = z.object({
  path: z.string().min(1),
  address: z.string().min(1),
  ufvk: z
    .string()
    .min(1)
    .nullish()
    .transform((value) => value ?? undefined),
  seedFingerprint: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .nullish()
    .transform((value) => value ?? undefined),
});
const signedSchema = z.object({
  pczt: zPrivacyHex(48 * 1024),
});
const responseSchema = z.object({ success: z.boolean(), payload: z.unknown() });
const errorSchema = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  error: z.string(),
  message: z.string().optional(),
  params: z.unknown().optional(),
  connectId: z.string().optional(),
  deviceId: z.string().optional(),
});

export type IZcashHardwareAddress = z.infer<typeof addressSchema>;
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
  zcashSignPczt: (
    connectId: string,
    deviceId: string,
    params: IParams,
  ) => Promise<unknown>;
};

function supportsZcash(sdk: unknown): sdk is IRawSdk {
  return (
    typeof sdk === 'object' &&
    sdk !== null &&
    'zcashGetAddress' in sdk &&
    typeof sdk.zcashGetAddress === 'function' &&
    'zcashSignPczt' in sdk &&
    typeof sdk.zcashSignPczt === 'function'
  );
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

// New SDKs expose these methods. Older SDKs must fail before any device operation.
// Every response is validated here; this adapter does not invent missing API exports.
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
  return { zcashGetAddress, zcashSignPczt };
}
