import { withTabLayout } from '@onekeyhq/components/src/Layout/withTabLayout';

import { toFocusedLazy } from '../../../../../components/LazyRenderWhenFocus';
import AddressBook from '../../../../../views/AddressBook/Listing';
import OnekeyLiteDetail from '../../../../../views/Hardware/OnekeyLite/Detail';
import MeScreen from '../../../../../views/Me';
import VolumeHaptic from '../../../../../views/Me/GenaralSection/VolumeHaptic';
import CloudBackup from '../../../../../views/Me/SecuritySection/CloudBackup';
import CloudBackupDetails from '../../../../../views/Me/SecuritySection/CloudBackup/BackupDetails';
import CloudBackupPreviousBackups from '../../../../../views/Me/SecuritySection/CloudBackup/PreviousBackups';
import WalletSwitch from '../../../../../views/Me/UtilSection/WalletSwitch';
import Protected from '../../../../../views/Protected';
import PushNotification from '../../../../../views/PushNotification';
import PushNotificationManageAccountDynamic from '../../../../../views/PushNotification/AccountDynamic';
import PushNotificationManagePriceAlert from '../../../../../views/PushNotification/PriceAlertListStack';
import { HomeRoutes, TabRoutes } from '../../../../routesEnum';

import { tabRoutesConfigBaseMap } from './tabRoutes.base';

import type { TabRouteConfig } from '../../../../types';

const name = TabRoutes.Me;
const config: TabRouteConfig = {
  ...tabRoutesConfigBaseMap[name],
  component: toFocusedLazy(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    withTabLayout(MeScreen, name),
    {
      rootTabName: name,
    },
  ),
  children: [
    {
      name: HomeRoutes.ScreenOnekeyLiteDetail,
      component: OnekeyLiteDetail,
    },
    {
      name: HomeRoutes.Protected,
      component: Protected,
    },
    {
      name: HomeRoutes.AddressBook,
      component: AddressBook,
      i18nTitle: 'title__address_book',
    },
    {
      name: HomeRoutes.WalletSwitch,
      component: WalletSwitch,
    },
    {
      name: HomeRoutes.VolumeHaptic,
      component: VolumeHaptic,
    },
    {
      name: HomeRoutes.CloudBackup,
      component: CloudBackup,
    },
    {
      name: HomeRoutes.CloudBackupPreviousBackups,
      component: CloudBackupPreviousBackups,
    },
    {
      name: HomeRoutes.CloudBackupDetails,
      component: CloudBackupDetails,
    },
    {
      name: HomeRoutes.PushNotification,
      component: PushNotification,
    },
    {
      name: HomeRoutes.PushNotificationManagePriceAlert,
      component: PushNotificationManagePriceAlert,
    },
    {
      name: HomeRoutes.PushNotificationManageAccountDynamic,
      component: PushNotificationManageAccountDynamic,
    },
  ],
};
export default config;
