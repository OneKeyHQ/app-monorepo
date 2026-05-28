import { PerpGuideContent } from '@onekeyhq/kit/src/views/Perp/components/Guide/PerpGuideContent';

export interface IWebAccountPanelArticlesProps {
  onRequestClose: () => void;
}

export function WebAccountPanelArticles({
  onRequestClose,
}: IWebAccountPanelArticlesProps) {
  return <PerpGuideContent onClose={onRequestClose} />;
}
