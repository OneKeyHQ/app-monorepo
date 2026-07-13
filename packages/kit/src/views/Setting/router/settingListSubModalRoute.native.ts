import { LazyLoadPage } from '../../../components/LazyLoadPage';

export const SettingListSubModal = LazyLoadPage(
  () => import('../pages/Tab/SettingListSubModal'),
);
