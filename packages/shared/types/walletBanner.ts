import type { ENotificationPushMessageMode } from './notification';

export interface IWalletBanner {
  _id: string;
  id: string;
  src: string;
  title: string;
  description: string;
  button: string;
  hrefType?: 'internal' | 'external';
  href?: string;
  mode?: ENotificationPushMessageMode;
  payload?: string | undefined;
  rank: number;
  closeable: boolean;
  closeForever: boolean;
  useSystemBrowser: boolean;
  theme: 'light' | 'dark';
  position?: 'home' | 'receive';
  networkId?: string;
}
