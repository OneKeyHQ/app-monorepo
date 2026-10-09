import type { ReactNode, RefObject } from 'react';

import type { ISheetOptions } from '../../hocs/NativeSheetPresentation/types';

export type IActionListRenderItemsParams = {
  handleActionListClose: () => void;
  handleActionListOpen: () => void;
};

export type IActionListRenderItemsAsync = (
  params: IActionListRenderItemsParams,
) => Promise<ReactNode>;

export type IResolvedAsyncItems = {
  requestId: number;
  items: ReactNode;
};

export type IUseAsyncItemsLifecycleProps = {
  isOpen: boolean;
  /** The list presents as an overlay sheet (native). */
  sheetPresentation?: boolean;
  renderItemsAsync?: IActionListRenderItemsAsync;
  handleActionListCloseRef: RefObject<() => void>;
  handleActionListOpenRef: RefObject<() => void>;
  sheetProps?: ISheetOptions;
};

export type IUseAsyncItemsLifecycleResult = {
  asyncItems?: IResolvedAsyncItems;
  handleAsyncItemsOpenChange: (openStatus: boolean) => void;
  resolvedSheetProps?: ISheetOptions;
};
