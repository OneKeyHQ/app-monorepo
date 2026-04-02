import { createContext, useCallback, useContext, useState } from 'react';

import noop from 'lodash/noop';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent, LayoutRectangle } from 'react-native';

const LAYOUT_PLACEHOLDER = {};

export interface IIPadModalPageContext {
  width?: number;
  height?: number;
}
export const iPadModalPageContext = createContext<IIPadModalPageContext>({});

export const useIPadModalPageSizeChange = platformEnv.isNativeIOSPad
  ? () => {
      const [layout, setLayout] = useState<LayoutRectangle>({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
      const onPageLayout = useCallback((event: LayoutChangeEvent) => {
        setLayout(event.nativeEvent.layout);
      }, []);
      return { layout, onPageLayout };
    }
  : () => {
      return {
        layout: LAYOUT_PLACEHOLDER,
        onPageLayout: noop,
      };
    };

export const useIPadModalPageWidth = platformEnv.isNativeIOSPad
  ? () => {
      const layout = useContext(iPadModalPageContext);
      return layout?.width;
    }
  : () => {
      return 0;
    };
