import type { ReactNode, RefObject } from 'react';

import type { SheetProps } from '../../shared/tamagui';

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
  renderItemsAsync?: IActionListRenderItemsAsync;
  handleActionListCloseRef: RefObject<() => void>;
  handleActionListOpenRef: RefObject<() => void>;
  sheetProps?: SheetProps;
};

export type IUseAsyncItemsLifecycleResult = {
  asyncItems?: IResolvedAsyncItems;
  handleAsyncItemsOpenChange: (openStatus: boolean) => void;
  resolvedSheetProps?: SheetProps;
};
