import { DAppItemType } from '../type';

export type SectionType = 'banner' | 'card' | 'list';

export type SectionDataType = {
  data: DAppItemType[];
  type: SectionType;
  title: string;
};
