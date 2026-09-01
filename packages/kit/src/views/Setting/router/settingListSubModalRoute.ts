import { LazyLoadPage } from '../../../components/LazyLoadPage';

export const SettingListSubModal = LazyLoadPage(
  () =>
    import(
      /* webpackChunkName: "settings-sub-pages" */ '@onekeyhq/kit/src/views/Setting/pages/Tab/SettingListSubModal'
    ),
);
