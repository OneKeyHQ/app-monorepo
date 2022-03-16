enum CredentialType {
  SOFTWARE = 'software',
  HARDWARE = 'hardware',
}

type SoftwareCredential = {
  type: CredentialType.SOFTWARE;
  seed: Buffer;
  password: string;
};

type HardwareCredential = {
  type: CredentialType.HARDWARE;
};

type CredentialSelector = SoftwareCredential | HardwareCredential;

export { CredentialType };
export type { CredentialSelector };
