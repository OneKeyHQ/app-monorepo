import { render, screen } from '@testing-library/react-native';

jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  View: 'View',
  Image: { resolveAssetSource: (source: unknown) => source },
}));

jest.mock('react-native-webview/src/RNCWebViewNativeComponent', () => ({
  __esModule: true,
  default: 'RNCWebView',
  Commands: {},
}));

jest.mock('react-native-webview/src/NativeRNCWebViewModule', () => ({
  __esModule: true,
  default: {},
}));

// Load the iOS implementation explicitly because the root Jest preset targets web.
const WebView = jest.requireActual<
  typeof import('react-native-webview/lib/WebView.ios')
>('react-native-webview/src/WebView.ios').default;

describe('iOS WebView media permission whitelist props', () => {
  it('preserves the default permission strategy when the whitelist is omitted', () => {
    render(<WebView testID="media-webview" />);

    expect(screen.getByTestId('media-webview')).toHaveProp(
      'hasMediaPermissionWhitelist',
      false,
    );
    expect(screen.getByTestId('media-webview')).not.toHaveProp(
      'mediaPermissionWhitelist',
    );
  });

  it('forwards an explicit empty whitelist on the first render', () => {
    render(<WebView testID="media-webview" mediaPermissionWhitelist={[]} />);

    expect(screen.getByTestId('media-webview')).toHaveProp(
      'hasMediaPermissionWhitelist',
      true,
    );
    expect(screen.getByTestId('media-webview')).toHaveProp(
      'mediaPermissionWhitelist',
      [],
    );
  });

  it('forwards the configured origins on the first render', () => {
    const whitelist = ['https://allowed.example'];
    render(
      <WebView testID="media-webview" mediaPermissionWhitelist={whitelist} />,
    );

    expect(screen.getByTestId('media-webview')).toHaveProp(
      'hasMediaPermissionWhitelist',
      true,
    );
    expect(screen.getByTestId('media-webview')).toHaveProp(
      'mediaPermissionWhitelist',
      whitelist,
    );
  });

  it.each([
    ['adds', undefined, ['https://allowed.example'], true],
    ['replaces', ['https://allowed.example'], ['https://other.example'], true],
    ['clears', ['https://allowed.example'], [], true],
    ['removes', ['https://allowed.example'], undefined, false],
  ] as const)(
    '%s the whitelist on the same mounted WebView',
    (_action, initialWhitelist, nextWhitelist, hasWhitelist) => {
      const initialProps = initialWhitelist
        ? { mediaPermissionWhitelist: [...initialWhitelist] }
        : {};
      const nextProps = nextWhitelist
        ? { mediaPermissionWhitelist: [...nextWhitelist] }
        : {};
      const { rerender } = render(
        <WebView testID="media-webview" {...initialProps} />,
      );
      const nativeView = screen.getByTestId('media-webview');

      rerender(<WebView testID="media-webview" {...nextProps} />);

      expect(screen.getByTestId('media-webview')).toBe(nativeView);
      expect(nativeView).toHaveProp(
        'hasMediaPermissionWhitelist',
        hasWhitelist,
      );
      if (nextWhitelist) {
        expect(nativeView).toHaveProp(
          'mediaPermissionWhitelist',
          nextWhitelist,
        );
      } else {
        expect(nativeView).not.toHaveProp('mediaPermissionWhitelist');
      }
    },
  );
});
