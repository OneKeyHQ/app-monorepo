export type BaseSliderProps = {
  disabled?: boolean;
  value?: number;
  min: number;
  max: number;
  step: number;
  onChange?: (value: number) => void;
};
