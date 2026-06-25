export const LOCAL_SECRET_ENVELOPE_PREFIX = '|LSE1|';

export const LOCAL_SECRET_ENVELOPE_VERSION = 1;

export const LOCAL_SECRET_ENVELOPE_INNER_PREFIX = {
  hdCredential: '|RP|',
  importedCredential: '|PK|',
  verifyString: '|VS|',
} as const;

export const LOCAL_SECRET_ENVELOPE_INNER_PREFIX_LABEL = {
  hdCredential: 'RP',
  importedCredential: 'PK',
  verifyString: 'VS',
} as const;

type ILocalSecretEnvelopeInnerPrefix =
  (typeof LOCAL_SECRET_ENVELOPE_INNER_PREFIX)[keyof typeof LOCAL_SECRET_ENVELOPE_INNER_PREFIX];

export function getLocalSecretEnvelopeInnerPrefix(
  value: string,
): ILocalSecretEnvelopeInnerPrefix | undefined {
  if (value.startsWith(LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential)) {
    return LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential;
  }
  if (value.startsWith(LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential)) {
    return LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential;
  }
  if (value.startsWith(LOCAL_SECRET_ENVELOPE_INNER_PREFIX.verifyString)) {
    return LOCAL_SECRET_ENVELOPE_INNER_PREFIX.verifyString;
  }
  return undefined;
}

export function getLocalSecretEnvelopeInnerPrefixLabel(
  innerPrefix: ILocalSecretEnvelopeInnerPrefix | undefined,
): string | undefined {
  if (innerPrefix === LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential) {
    return LOCAL_SECRET_ENVELOPE_INNER_PREFIX_LABEL.hdCredential;
  }
  if (innerPrefix === LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential) {
    return LOCAL_SECRET_ENVELOPE_INNER_PREFIX_LABEL.importedCredential;
  }
  if (innerPrefix === LOCAL_SECRET_ENVELOPE_INNER_PREFIX.verifyString) {
    return LOCAL_SECRET_ENVELOPE_INNER_PREFIX_LABEL.verifyString;
  }
  return undefined;
}

export function getLocalSecretEnvelopeInnerPrefixByLabel(
  label: string,
): ILocalSecretEnvelopeInnerPrefix | undefined {
  if (label === LOCAL_SECRET_ENVELOPE_INNER_PREFIX_LABEL.hdCredential) {
    return LOCAL_SECRET_ENVELOPE_INNER_PREFIX.hdCredential;
  }
  if (label === LOCAL_SECRET_ENVELOPE_INNER_PREFIX_LABEL.importedCredential) {
    return LOCAL_SECRET_ENVELOPE_INNER_PREFIX.importedCredential;
  }
  if (label === LOCAL_SECRET_ENVELOPE_INNER_PREFIX_LABEL.verifyString) {
    return LOCAL_SECRET_ENVELOPE_INNER_PREFIX.verifyString;
  }
  return undefined;
}
