enum CredentialType {
  SOFTWARE = 'software', // HD
  HARDWARE = 'hardware',
  PRIVATE_KEY = 'private_key',
}

type SoftwareCredential = {
  type: CredentialType.SOFTWARE;
  seed: Buffer;
  password: string;
};

type HardwareCredential = {
  type: CredentialType.HARDWARE;
};

type PrivateKeyCredential = {
  type: CredentialType.PRIVATE_KEY;
  privateKey: Buffer;
  password: string;
};

type CredentialSelector =
  | SoftwareCredential
  | HardwareCredential
  | PrivateKeyCredential;

export { CredentialType };
export type { CredentialSelector, PrivateKeyCredential };
