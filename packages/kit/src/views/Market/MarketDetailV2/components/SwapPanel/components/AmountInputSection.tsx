import { Input, Select, XStack } from '@onekeyhq/components';

interface IToken {
  label: string;
  value: string;
  price?: number; // Optional as it might not be needed for display in select
}

export function AmountInputSection({
  value,
  onChange,
  selectedToken,
  selectableTokens,
  onTokenChange,
}: {
  value: string;
  onChange: (value: string) => void;
  selectedToken?: IToken;
  selectableTokens: IToken[];
  onTokenChange: (tokenSymbol: string) => void;
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
                items={selectableTokens.map((token) => ({
                  label: token.label,
                  value: token.value,
                }))}
                value={selectedToken?.value}
                onChange={onTokenChange}
                title="Select Token"
                floatingPanelProps={{
                  width: 100, // Adjust as needed
                }}
              />
            </XStack>
          ),
        },
      ]}
    />
  );
}
