import { z } from 'zod';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import type { HardwareSDK } from '@onekeyhq/shared/src/hardware/instance';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const STARK_FIELD_PRIME = 2n ** 251n + 17n * 2n ** 192n + 1n;
const felt = z
  .string()
  .regex(/^0x[0-9a-fA-F]{1,64}$/)
  .refine(
    (value) =>
      /^0x[0-9a-fA-F]{1,64}$/.test(value) && BigInt(value) < STARK_FIELD_PRIME,
  );
const publicKey = felt.refine((value) => /^0x[0-9a-fA-F]{64}$/.test(value));
const publicKeySchema = z.object({ path: z.string().min(1), pub: publicKey });
const addressSchema = z.object({ path: z.string().min(1), address: felt });
const signedSchema = z.object({
  transactionHash: felt,
  signature: z.string().regex(/^0x[0-9a-fA-F]{128}$/),
});
const responseSchema = z.object({ success: z.boolean(), payload: z.unknown() });
const errorSchema = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  error: z.string(),
  message: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional().catch(undefined),
  connectId: z.string().optional(),
  deviceId: z.string().optional(),
});

type IResponse<T> =
  | { success: true; payload: T }
  | { success: false; payload: z.infer<typeof errorSchema> };

type IStarknetHardwareSdk = Pick<
  typeof HardwareSDK,
  | 'starknetGetPublicKey'
  | 'starknetGetAddress'
  | 'starknetSignTransaction'
  | 'starknetExportPrivacyViewingKey'
>;

type IBundleParams<T extends 'starknetGetPublicKey' | 'starknetGetAddress'> =
  Parameters<IStarknetHardwareSdk[T]>[2] & { bundle: unknown[] };

function parseResponse<T>(value: unknown, schema: z.ZodType<T>): IResponse<T> {
  const response = responseSchema.safeParse(value);
  if (!response.success) {
    throw new OneKeyInternalError({
      key: ETranslations.hardware_communication_error,
    });
  }
  if (!response.data.success) {
    const error = errorSchema.safeParse(response.data.payload);
    if (!error.success) {
      throw new OneKeyInternalError({
        key: ETranslations.hardware_communication_error,
      });
    }
    return { success: false, payload: error.data };
  }
  const payload = schema.safeParse(response.data.payload);
  if (!payload.success) {
    throw new OneKeyInternalError({
      key: ETranslations.hardware_communication_error,
    });
  }
  return { success: true, payload: payload.data };
}

export function getStarknetHardwareSdk(sdk: IStarknetHardwareSdk) {
  return {
    async starknetGetPublicKey(
      connectId: string,
      deviceId: string,
      params: IBundleParams<'starknetGetPublicKey'>,
    ) {
      return parseResponse(
        await sdk.starknetGetPublicKey(connectId, deviceId, params),
        z.array(publicKeySchema).length(params.bundle.length),
      );
    },
    async starknetGetAddress(
      connectId: string,
      deviceId: string,
      params: IBundleParams<'starknetGetAddress'>,
    ) {
      return parseResponse(
        await sdk.starknetGetAddress(connectId, deviceId, params),
        z.array(addressSchema).length(params.bundle.length),
      );
    },
    async starknetSignTransaction(
      connectId: string,
      deviceId: string,
      params: Parameters<IStarknetHardwareSdk['starknetSignTransaction']>[2],
    ) {
      return parseResponse(
        await sdk.starknetSignTransaction(connectId, deviceId, params),
        signedSchema,
      );
    },
    async starknetExportPrivacyViewingKey(
      connectId: string,
      deviceId: string,
      params: Parameters<
        IStarknetHardwareSdk['starknetExportPrivacyViewingKey']
      >[2],
    ) {
      return parseResponse(
        await sdk.starknetExportPrivacyViewingKey(connectId, deviceId, params),
        z.object({ viewingKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }),
      );
    },
  };
}
