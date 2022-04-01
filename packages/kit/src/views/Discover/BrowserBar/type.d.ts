export type BrowserBarViewProps = {
  searchContent?: string;
  onSearchContentChange?: (text: string) => void;
  onSearchSubmitEditing?: (text: string) => void;
  onGoBack?: () => void;
  onNext?: () => void;
  onRefresh?: () => void;
  onMore?: () => void;
};
