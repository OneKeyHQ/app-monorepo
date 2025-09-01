export interface IWalletBanner {
  _id: string;
  id: string;
  src: string;
  title: string;
  description: string;
  button: string;
  hrefType: 'internal' | 'external';
  href: string;
  rank: number;
  closeable: boolean;
  closeForever: boolean;
  useSystemBrowser: boolean;
  theme: 'light' | 'dark';
}
