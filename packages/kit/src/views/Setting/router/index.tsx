import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { ModalAddressBookRouter } from '../../AddressBook/router';

const SettingAccountDerivationModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/AccountDerivation'),
);

const SettingAppAutoLockModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/AppAutoLock'),
);

const SettingCurrencyModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/Currency'),
);
const SettingListModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/List'),
);
const SettingProtectionModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/Protection'),
);
const SettingSpendUTXOModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/SpendUTXO'),
);
const SettingCustomRPCModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/CustomRPC'),
);

const SettingSignatureRecordModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/SignatureRecord'),
);

const FirmwareUpdateDevSettings = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Setting/pages/FirmwareUpdateDevSettings'),
);

const V4MigrationDevSettings = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/V4MigrationDevSettings'),
);

const ExportCustomNetworkConfig = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Setting/pages/ExportCustomNetworkConfig'),
);

export const ModalSettingStack: IModalFlowNavigatorConfig<
  EModalSettingRoutes | EModalAddressBookRoutes,
  IModalSettingParamList & IModalAddressBookParamList
>[] = [
  {
    name: EModalSettingRoutes.SettingListModal,
    component: SettingListModal,
  },
  {
    name: EModalSettingRoutes.SettingCurrencyModal,
    component: SettingCurrencyModal,
  },
  {
    name: EModalSettingRoutes.SettingSpendUTXOModal,
    component: SettingSpendUTXOModal,
  },
  {
    name: EModalSettingRoutes.SettingAccountDerivationModal,
    component: SettingAccountDerivationModal,
  },
  {
    name: EModalSettingRoutes.SettingCustomRPC,
    component: SettingCustomRPCModal,
  },
  {
    name: EModalSettingRoutes.SettingAppAutoLockModal,
    component: SettingAppAutoLockModal,
  },
  {
    name: EModalSettingRoutes.SettingProtectModal,
    component: SettingProtectionModal,
  },
  {
    name: EModalSettingRoutes.SettingSignatureRecordModal,
    component: SettingSignatureRecordModal,
  },
  {
    name: EModalSettingRoutes.SettingDevFirmwareUpdateModal,
    component: FirmwareUpdateDevSettings,
  },
  {
    name: EModalSettingRoutes.SettingDevV4MigrationModal,
    component: V4MigrationDevSettings,
  },
  {
    name: EModalSettingRoutes.SettingExportCustomNetworkConfig,
    component: ExportCustomNetworkConfig,
  },
  ...(ModalAddressBookRouter as IModalFlowNavigatorConfig<
    EModalSettingRoutes | EModalAddressBookRoutes,
    IModalSettingParamList & IModalAddressBookParamList
  >[]),
];
