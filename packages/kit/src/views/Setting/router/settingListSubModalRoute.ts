import { LazyLoadPage } from '../../../components/LazyLoadPage';

export const SettingListSubModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Setting/pages/Tab/SettingListSubModal'),
);
