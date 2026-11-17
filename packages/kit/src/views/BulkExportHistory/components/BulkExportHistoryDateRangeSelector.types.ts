export type IBulkExportHistoryDateRangeSelectorProps = {
  value: string | number;
  options: {
    label: string;
    value: string | number;
    testID?: string;
    disabled?: boolean;
  }[];
  onChange: (value: string | number) => void;
  disabled?: boolean;
  testID?: string;
};
