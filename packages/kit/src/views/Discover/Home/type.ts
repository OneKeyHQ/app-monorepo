import { DAppItemType } from '../type';

export type SectionType = 'banner' | 'card' | 'list';

export interface SectionDataType {
  title: string;
  data: DAppItemType[];
  type?: SectionType;
  onItemSelect?: (item: DAppItemType) => Promise<boolean> | void;
}
