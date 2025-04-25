import type { IStackProps } from '@onekeyhq/components';
import { Button, Popover } from '@onekeyhq/components';

import { LiquidityFilterContent } from './LiquidityFilterContent';

type ILiquidityFilterControlProps = {
  value?: { min?: string; max?: string };
  onChange?: (value: { min?: string; max?: string }) => void;
  onApply?: (value: { min?: string; max?: string }) => void;
} & IStackProps;

function LiquidityFilterControl({
  value: valueProp,
  onChange,
  onApply,
  ...rest
}: ILiquidityFilterControlProps) {
  return (
    <Popover
      title="Liquidity ($)"
      renderTrigger={
        <Button variant="secondary" size="small">
          Liquidity
        </Button>
      }
      renderContent={
        <LiquidityFilterContent
          value={valueProp}
          onChange={onChange}
          onApply={onApply}
        />
      }
      placement="bottom-start"
      {...rest}
    />
  );
}

export { LiquidityFilterControl };
