import { patchTags } from '@keystonehq/bc-ur-registry';

import { ExtendedRegistryTypes } from './RegistryType';

// oxlint-disable-next-line import/export -- re-export from third-party module
export * from '@keystonehq/bc-ur-registry';

patchTags(
  Object.values(ExtendedRegistryTypes)
    .filter((rt) => !!rt.getTag())
    .map((rt) => rt.getTag()),
);

export { TronSignRequest, SignType } from './TronSignRequest';
export { TronSignature } from './TronSignature';
