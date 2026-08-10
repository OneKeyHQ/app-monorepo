import { LazyLoadPage } from '../../../components/LazyLoadPage';

const loadSettingListSubModal = () =>
  import('@onekeyhq/kit/src/views/Setting/pages/Tab/SettingListSubModal');

export const SettingListSubModal = LazyLoadPage(loadSettingListSubModal);

export const SettingOfficialChannels = LazyLoadPage(() =>
  loadSettingListSubModal().then(({ OfficialChannelsPage }) => ({
    default: OfficialChannelsPage,
  })),
);
