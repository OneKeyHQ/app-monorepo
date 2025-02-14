import { ConfigProvider } from '@onekeyhq/components';

import webEmbedAppSettings from '../utils/webEmbedAppSettings';

export default function WebEmbedAppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = webEmbedAppSettings.getSettings();

  // TODO Toast support
  return (
    <ConfigProvider
      theme={(settings?.themeVariant as any) || 'light'}
      locale={(settings?.localeVariant as any) || 'en-US'}
    >
      {children}
    </ConfigProvider>
  );
}
