import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import {
  UIManager,
  findNodeHandle,
  requireNativeComponent,
} from 'react-native';

import type { IGeckoViewProps, IWebViewCommands } from './type';
import type { NativeSyntheticEvent } from 'react-native';

const GeckoViewNative = requireNativeComponent<IGeckoViewProps>('GeckoView');

const GeckoView = forwardRef<IWebViewCommands, IGeckoViewProps>(
  (props, ref) => {
    const {
      style,
      forceDarkOn,
      autoFillEnabled,
      source,
      onLoadingStart,
      onLoadingError,
      onLoadingProgress,
      onMessage,
      onLoadingFinish,
      onMessagingDisconnected,
      injectedJavaScript,
      injectedJavaScriptBeforeContentLoaded,
      remoteDebugging,
    } = props;

    const currentViewRef = useRef(null);
    const dispatchCommand = useCallback(
      (command: keyof IWebViewCommands, args?: any[]) => {
        const node = findNodeHandle(currentViewRef.current);
        UIManager.dispatchViewManagerCommand(node, command, args || []);
      },
      [currentViewRef],
    );

    useImperativeHandle(ref, () => ({
      goBack: () => {
        dispatchCommand('goBack');
      },
      goForward: () => {
        dispatchCommand('goForward');
      },
      reload: () => {
        dispatchCommand('reload');
      },
      stopLoading: () => {
        dispatchCommand('stopLoading');
      },
      postMessage: (message: string) => {
        dispatchCommand('postMessage', [message]);
      },
      injectJavaScript: (script: string) => {
        dispatchCommand('injectJavaScript', [script]);
      },
      loadUrl: (url: string) => {
        dispatchCommand('loadUrl', [url]);
      },
      requestFocus: () => {
        dispatchCommand('requestFocus');
      },
      clearHistory: () => {
        dispatchCommand('clearHistory');
      },
      clearCache: () => {
        dispatchCommand('clearCache');
      },
      connectMessagingPort: () => {
        dispatchCommand('connectMessagingPort');
      },
    }));

    useEffect(() => {
      setTimeout(() => {
        dispatchCommand('injectJavaScript', [injectedJavaScript]);
      }, 10);
    }, [dispatchCommand, injectedJavaScript, ref]);

    const handleMessage = useCallback(
      (event: NativeSyntheticEvent<{ data: string; url: string }>) => {
        event.nativeEvent.url = source?.uri || '';
        onMessage?.(event);
      },
      [onMessage, source?.uri],
    );

    return (
      <GeckoViewNative
        style={style}
        ref={currentViewRef}
        forceDarkOn={forceDarkOn}
        autoFillEnabled={autoFillEnabled}
        source={source}
        onLoadingStart={onLoadingStart}
        onLoadingError={onLoadingError}
        onLoadingProgress={onLoadingProgress}
        onMessage={handleMessage}
        onLoadingFinish={onLoadingFinish}
        onMessagingDisconnected={onMessagingDisconnected}
        injectedJavaScript={injectedJavaScriptBeforeContentLoaded}
        remoteDebugging={remoteDebugging}
      />
    );
  },
);

GeckoView.displayName = 'GeckoView';

export default GeckoView;

export * from './type';
