import { RouteProp } from '@react-navigation/native';

import OnekeyLiteBackup from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Backup';
import OnekeyLiteChangePin from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/ChangePin';
import OnekeyLitePinCode from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/PinCode';
import OnekeyLiteReset from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Reset';
import OnekeyLiteRestore from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Restore';
import {
  OnekeyLiteModalRoutes,
  OnekeyLiteRoutesParams,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/routes';

export type OnekeyLiteRouteProp = RouteProp<
  OnekeyLiteRoutesParams,
  OnekeyLiteModalRoutes
>;

const modalRoutes = [
  {
    name: OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal,
    component: OnekeyLitePinCode,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLiteRestoreModal,
    component: OnekeyLiteRestore,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLiteBackupModal,
    component: OnekeyLiteBackup,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLiteChangePinModal,
    component: OnekeyLiteChangePin,
  },
  {
    name: OnekeyLiteModalRoutes.OnekeyLiteResetModal,
    component: OnekeyLiteReset,
  },
];

export { OnekeyLiteModalRoutes, modalRoutes };
export type { OnekeyLiteRoutesParams };
