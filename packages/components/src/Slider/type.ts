export type BaseSliderProps = {
  disabled?: boolean;
  defaultValue?: number | undefined;
  value?: number | undefined;
  onValueChange?: (value: number) => void;
};
