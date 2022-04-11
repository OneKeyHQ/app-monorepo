enum CredentialType {
  SOFTWARE = 'software', // HD
  HARDWARE = 'hardware',
  PRIVATE_KEY = 'private_key', // Imported
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

export type PrivateKeyCredential = {
  type: CredentialType.PRIVATE_KEY;
  privateKey: Buffer;
  password: string;
};

export type WatchingCredential = {
  type: CredentialType.WATCHING;
};

type CredentialSelector =
  | SoftwareCredential
  | HardwareCredential
  | PrivateKeyCredential
  | WatchingCredential;

enum UserCreateInputCategory {
  INVALID,
  MNEMONIC,
  PRIVATE_KEY,
  ADDRESS,
}

type UserCreateInput = {
  category: UserCreateInputCategory;
  possibleNetworks?: Array<string>;
};

export { CredentialType, UserCreateInputCategory };
export type { CredentialSelector, UserCreateInput };
