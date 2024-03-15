import { useThemeValue } from './useStyle';

export const useSelectionColor = () => {
  const selectionColor = useThemeValue('bgPrimaryActive');
  return selectionColor;
};
