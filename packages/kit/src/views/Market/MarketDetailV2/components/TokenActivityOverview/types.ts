export interface ITimeRangeOption {
  label: string;
  value: string;
  percentageChange: string;
  isPositive: boolean;
  isZero?: boolean;
}

export interface ITransactionRowProps {
  label: string;
  buyCount: number | undefined;
  sellCount: number | undefined;
  totalCount: number | undefined;
  isLoading?: boolean;
}

export interface IVolumeRowProps {
  label: string;
  buyVolume: number | undefined;
  sellVolume: number | undefined;
  totalVolume: number | undefined;
  isLoading?: boolean;
}

export interface ITimeRangeSelectorProps {
  options: ITimeRangeOption[];
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
}
