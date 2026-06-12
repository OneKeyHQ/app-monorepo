export const LOCAL_SECRET_ENVELOPE_PREFIX = '|LSE1|';

export const LOCAL_SECRET_ENVELOPE_VERSION = 1;

export const LOCAL_SECRET_ENVELOPE_INNER_PREFIX = {
  hdCredential: '|RP|',
  importedCredential: '|PK|',
  verifyString: '|VS|',
} as const;
