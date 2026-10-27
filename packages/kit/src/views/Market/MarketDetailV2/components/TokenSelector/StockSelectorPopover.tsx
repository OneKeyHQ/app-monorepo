import { Popover } from '@onekeyhq/components';

import type { IStockSelectorPopoverProps } from './StockSelectorPopover.type';

export function StockSelectorPopover(props: IStockSelectorPopoverProps) {
  return <Popover {...props} />;
}

export type { IStockSelectorPopoverProps } from './StockSelectorPopover.type';
