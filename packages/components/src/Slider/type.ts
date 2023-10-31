export type BaseSliderProps = {
  disabled?: boolean;
  defaultValue?: number | undefined;
  value?: number | undefined;
  onChange?: (value: number) => void;
};
