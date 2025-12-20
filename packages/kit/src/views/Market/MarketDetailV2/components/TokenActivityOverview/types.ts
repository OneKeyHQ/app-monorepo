export interface ITimeRangeOption {
  label: string;
  value: string;
  percentageChange: string;
  isPositive: boolean;
  isZero?: boolean;
}

export interface ITransactionRowProps {
  label: string;
  buyCount: number;
  sellCount: number;
  totalCount: number;
  isLoading?: boolean;
}

export interface IVolumeRowProps {
  label: string;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  isLoading?: boolean;
}

export interface ITimeRangeSelectorProps {
  options: ITimeRangeOption[];
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
}
