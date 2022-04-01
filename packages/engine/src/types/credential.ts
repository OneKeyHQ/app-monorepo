enum CredentialType {
  SOFTWARE = 'software', // HD
  HARDWARE = 'hardware',
  PRIVATE_KEY = 'private_key',
  IMPORTED = 'imported',
  WATCHING = 'watching',
}

export type SoftwareCredential = {
  type: CredentialType.SOFTWARE;
  seed: Buffer;
  password: string;
};

export type HardwareCredential = {
  type: CredentialType.HARDWARE;
};

type PrivateKeyCredential = {
  type: CredentialType.PRIVATE_KEY;
  privateKey: Buffer;
  password: string;
};
export type ImportedCredential = {
  type: CredentialType.IMPORTED;
};

export type WatchingCredential = {
  type: CredentialType.WATCHING;
};

type CredentialSelector =
  | SoftwareCredential
  | HardwareCredential
  | PrivateKeyCredential
  | ImportedCredential
  | WatchingCredential;

export { CredentialType };
export type { CredentialSelector, PrivateKeyCredential };
