export const LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD =
  'localSecretEnvelopeDataType' as const;

export const LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE =
  'credential' as const;

export type ILocalSecretEnvelopeCredentialErrorData = Record<
  typeof LOCAL_SECRET_ENVELOPE_ERROR_DATA_TYPE_FIELD,
  typeof LOCAL_SECRET_ENVELOPE_CREDENTIAL_ERROR_DATA_TYPE
>;
