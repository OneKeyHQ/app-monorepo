export interface ICategoryTab {
  tabId: string;
  name: string;
}

export interface IMarketPerpsCategorySelectorProps {
  categories: ICategoryTab[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  containerStyle?: Record<string, unknown>;
}
