import { DAppItemType } from '../type';

export type SectionType = 'banner' | 'card' | 'list';

export type SectionDataType = {
  title: string;
  data: DAppItemType[];
  type?: SectionType;
  onItemSelect?: (item: DAppItemType) => void;
};
