import { createRuntimeWalletEffectTransport } from '../../travelMode/runtimeWalletEffectTransport';

import { AppleCloudKitStorage } from './AppleCloudKitStorage';

const appleCloudKitStorage = createRuntimeWalletEffectTransport(
  new AppleCloudKitStorage(),
);

export { appleCloudKitStorage };
