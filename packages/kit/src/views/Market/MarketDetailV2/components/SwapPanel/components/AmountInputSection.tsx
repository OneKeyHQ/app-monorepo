import { Input, Select, XStack } from '@onekeyhq/components';

export function AmountInputSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      placeholder="Total"
      value={value}
      onChangeText={onChange}
      $gtMd={{
        size: 'large',
      }}
      addOns={[
        {
          renderContent: (
            <XStack>
              <Select
                items={[
                  { label: 'SOL', value: 'sol' },
                  { label: 'USDC', value: 'usdc' },
                ]}
                value="sol"
                title="Select Token"
                floatingPanelProps={{
                  width: 100,
                }}
              />
            </XStack>
          ),
        },
      ]}
    />
  );
}
