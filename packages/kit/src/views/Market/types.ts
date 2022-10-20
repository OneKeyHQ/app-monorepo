import { MessageDescriptor } from 'react-intl';

import { ICON_NAMES } from '@onekeyhq/components/src';
import { Token as TokenType } from '@onekeyhq/engine/src/types/token';

import { MarketCategory } from '../../store/reducers/market';

export type CommonPriceCardProps = {
  onPress?: () => void;
  token: TokenType;
};

export type MarketCategoryHeadProps = {
  categorys: MarketCategory[];
};

export type MarketCategoryToggleItem = MarketCategory & {
  leftIconName?: ICON_NAMES;
  leftIconSize?: number;
  rightIconName?: ICON_NAMES;
  rightIconSize?: number;
};

export type MarketCategoryToggleComponentProp = {
  items: MarketCategoryToggleItem[];
  onSelect: (item: MarketCategoryToggleItem) => void;
};

export type ListHeadTagType = {
  id: number;
  title?: MessageDescriptor['id'];
  minW: string;
  textAlign?: 'center' | 'left' | 'right';
  showVerticalLayout?: boolean;
  showNorMalDevice?: boolean;
};
