import { useIntl } from 'react-intl';

// Keep temporary module copy together until the shared i18n pass.
const ENGLISH_COPY = {
  marketWidgets: 'Market widgets',
  singleCoin: 'Single coin',
  marketList: 'Market list',
  hotCoins: 'Hot coins',
  source: 'Source',
  coin: 'Coin',
  configurations: 'Configurations',
  newConfiguration: 'New configuration',
  editConfiguration: 'Edit configuration',
  noConfigurations: 'No configurations',
  listDescription: 'Shows the first 3 coins from the selected source.',
  bindingHint:
    'Touch and hold the Home Screen widget, tap “Edit Widget”, then select your saved configuration under “Configuration”.',
  privacyUnavailable: 'Widgets cannot be edited in Travel Mode.',
  assetUnavailable:
    'This coin is no longer in the selected source. Choose another coin.',
  unavailableConfiguration:
    'This configuration no longer exists. Go back and choose another.',
};

const CHINESE_COPY: Record<keyof typeof ENGLISH_COPY, string> = {
  marketWidgets: '行情小组件',
  singleCoin: '单币',
  marketList: '行情列表',
  hotCoins: '热门币种',
  source: '来源',
  coin: '币种',
  configurations: '配置',
  newConfiguration: '新建配置',
  editConfiguration: '编辑配置',
  noConfigurations: '暂无配置',
  listDescription: '显示所选来源的前 3 个币种',
  bindingHint: '长按桌面小组件，选择“编辑小组件”，再在“配置”中选择刚保存的配置',
  privacyUnavailable: '旅行模式下无法编辑小组件',
  assetUnavailable: '此币种已不在所选来源中，重新选择币种',
  unavailableConfiguration: '此配置已不存在，返回后重新选择',
};

export function useMarketWidgetCopy() {
  const { locale } = useIntl();
  return locale.toLowerCase().startsWith('zh') ? CHINESE_COPY : ENGLISH_COPY;
}
