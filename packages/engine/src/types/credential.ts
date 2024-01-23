import type { AccountNameInfo } from './network';

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

export type PrivateKeyCredentialWithId = PrivateKeyCredential & { id: string };

export type WatchingCredential = {
  type: CredentialType.WATCHING;
};

type CredentialSelector =
  | SoftwareCredential
  | HardwareCredential
  | PrivateKeyCredential
  | WatchingCredential;

enum UserInputCategory {
  MNEMONIC = 'mnemonic',
  IMPORTED = 'imported',
  WATCHING = 'watching',
  ADDRESS = 'address',
}

type UserInputCheckResult = {
  category: UserInputCategory;
  possibleNetworks?: Array<string>;
  derivationOptions?: AccountNameInfo[];
};

export { CredentialType, UserInputCategory };
export type { CredentialSelector, UserInputCheckResult };
