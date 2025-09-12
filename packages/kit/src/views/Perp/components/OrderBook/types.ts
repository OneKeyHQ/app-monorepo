export type IAggregationBtn = (
  /** The currently selected tick size */
  selectedTickSize: number,
  /** The tick size of this button */
  tickSize: number,
  /** Should be called on press of the button, passing this button's tick size */
  onChange: (tickSize: number) => void,
) => React.ReactNode;

export interface IOBLevel {
  /** The price of this level */
  price: number;
  /** The size of this level */
  size: number;
  /** The cumulative size of all levels up to and including this one */
  cumSize: number;
}

export type ITick<T> = [coord: number, value: T];
export type INTick = ITick<number>;
