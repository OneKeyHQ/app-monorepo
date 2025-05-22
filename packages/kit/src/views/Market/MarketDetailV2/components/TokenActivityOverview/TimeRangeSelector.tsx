import { SegmentControl, SizableText, Stack } from '@onekeyhq/components';

type ITimeRangeOption = {
  label: string;
  value: string;
  percentageChange: string;
  isPositive: boolean;
};

type ITimeRangeSelectorProps = {
  options: ITimeRangeOption[];
  value: string;
  onChange: (value: string) => void;
};

export function TimeRangeSelector({
  options,
  value,
  onChange,
}: ITimeRangeSelectorProps) {
  return (
    <Stack>
      <SegmentControl
        value={value}
        onChange={(newValue) => {
          onChange(newValue as string);
        }}
        options={options.map((opt) => ({ label: opt.label, value: opt.value }))}
      />
      <Stack flexDirection="row" justifyContent="space-around" mt="$2">
        {options.map((opt) => (
          <SizableText
            key={opt.value}
            size="$bodySm"
            color={opt.isPositive ? '$textSuccess' : '$textCritical'}
          >
            {opt.percentageChange}
          </SizableText>
        ))}
      </Stack>
    </Stack>
  );
}
