import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import {
  UIManager,
  findNodeHandle,
  requireNativeComponent,
} from 'react-native';

import type { IGeckoViewProps, IWebViewCommands } from './type';

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
        onMessage={onMessage}
        onLoadingFinish={onLoadingFinish}
        onMessagingDisconnected={onMessagingDisconnected}
        injectedJavaScript={injectedJavaScript}
        remoteDebugging={remoteDebugging}
      />
    );
  },
);

GeckoView.displayName = 'GeckoView';

export default GeckoView;

export * from './type';
