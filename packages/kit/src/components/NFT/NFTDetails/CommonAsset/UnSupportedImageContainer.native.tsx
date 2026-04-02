import { WebView } from 'react-native-webview';

export const UnSupportedImageContainer = ({ src }: { src?: string }) => (
  <WebView
    javaScriptEnabled={false}
    source={{
      html: `<img width="100%" src="${src || ''}"></img>`,
    }}
  />
);
