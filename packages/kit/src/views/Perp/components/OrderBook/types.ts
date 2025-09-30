export type IAggregationBtn = (
  /** The currently selected tick size */
  selectedTickSize: number,
  /** The tick size of this button */
  tickSize: number,
  /** Should be called on press of the button, passing this button's tick size */
  onChange: (tickSize: number) => void,
) => React.ReactNode;

export interface IOBLevel {
  /** The price of this level as string to maintain precision */
  price: string;
  /** The size of this level as string to maintain precision */
  size: string;
  /** The cumulative size of all levels up to and including this one as string to maintain precision */
  cumSize: string;
}

export interface IFormattedOBLevel extends IOBLevel {
  /** Human readable representation of size for rendering */
  displaySize: string;
  /** Human readable representation of cumulative size for rendering */
  displayCumSize: string;
}

export interface IAggregatedBookResult {
  bids: IFormattedOBLevel[];
  asks: IFormattedOBLevel[];
  maxBidSize: string;
  maxAskSize: string;
}

export type ITick<T> = [coord: number, value: T];
export type INTick = ITick<number>;
