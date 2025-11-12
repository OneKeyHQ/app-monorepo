import { Empty } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function CloudBackupListEmptyView() {
  // TODO: franco 暂无备份
  // - iOS: 提示用户可能没有登录 iCloud，没有开启 iCloud 和 keychain 同步，或网络故障
  if (platformEnv.isNativeIOS || platformEnv.isDesktopMac) {
    return (
      <Empty title="No iCloud backups found. Please check iCloud sign-in, enable iCloud and Keychain sync, or verify your network connection." />
    );
  }
  // - Android: 提示用户可能没有登录 GoogleDrive，或者登录了错误的 Google 账户，或网络故障
  return (
    <Empty title="No Google Drive backups found. Please check Google Drive sign-in, ensure you're using the correct Google account, or verify your network connection." />
  );
}

export function CloudBackupDetailsEmptyView() {
  // TODO: franco 没有可以备份的钱包，请先去创建钱包和账户
  return (
    <Empty title="No wallets available to back up. Please create a wallet and account first." />
  );
}
