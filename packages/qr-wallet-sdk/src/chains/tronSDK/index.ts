import { patchTags } from '@keystonehq/bc-ur-registry';

import { ExtendedRegistryTypes } from './RegistryType';

export * from '@keystonehq/bc-ur-registry';

patchTags(
  Object.values(ExtendedRegistryTypes)
    .filter((rt) => !!rt.getTag())
    .map((rt) => rt.getTag()),
);

export { TronSignRequest, SignType } from './TronSignRequest';
export { TronSignature } from './TronSignature';
