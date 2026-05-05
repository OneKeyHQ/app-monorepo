import { useTheme } from './useStyle';

export const useSelectionColor = () => {
  const theme = useTheme();
  const selectionColor = theme.bgPrimaryActive.val;
  return selectionColor;
};
