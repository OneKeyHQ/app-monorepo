export interface ITimeRangeOption {
  label: string;
  value: string;
  percentageChange: string;
  isPositive: boolean;
}

export interface ITransactionRowProps {
  label: string;
  buyCount: number;
  sellCount: number;
  totalCount: number;
}

export interface IVolumeRowProps {
  label: string;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
}

export interface ITimeRangeSelectorProps {
  options: ITimeRangeOption[];
  value: string;
  onChange: (value: string) => void;
}
