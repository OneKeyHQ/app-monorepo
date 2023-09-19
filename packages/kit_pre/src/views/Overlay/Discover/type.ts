import type { SelectProps } from '@onekeyhq/components/src/Select';

import type { MatchDAppItemType } from '../../Discover/Explorer/explorerUtils';

export type ShowMenuProps = (data: {
  triggerEle?: SelectProps['triggerEle'];
  dapp: MatchDAppItemType;
  title?: string;
}) => void;
