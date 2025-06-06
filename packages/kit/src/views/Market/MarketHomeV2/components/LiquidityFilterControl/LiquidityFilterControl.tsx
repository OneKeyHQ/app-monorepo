import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { Button, Popover } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { formatLiquidityFilterDisplay } from '../../utils';

import { LiquidityFilterContent } from './LiquidityFilterContent';

type ILiquidityFilterControlProps = {
  value?: { min?: string; max?: string };
  onApply?: (value: { min?: string; max?: string }) => void;
} & IStackProps;

function LiquidityFilterControl({
  value: valueProp,
  onApply,
  ...rest
}: ILiquidityFilterControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const intl = useIntl();

  const handleClose = () => {
    setIsOpen(false);
  };

  const liquidityText = intl.formatMessage({
    id: ETranslations.global_liquidity,
  });
  const buttonText = formatLiquidityFilterDisplay(valueProp, liquidityText);
  const hasFilter = valueProp && (valueProp.min || valueProp.max);
  const popoverTitle = `${liquidityText} ($)`;

  return (
    <Popover
      title={popoverTitle}
      open={isOpen}
      onOpenChange={setIsOpen}
      renderTrigger={
        <Button
          variant={hasFilter ? 'primary' : 'secondary'}
          size="small"
          {...rest}
        >
          {buttonText}
        </Button>
      }
      renderContent={
        <LiquidityFilterContent
          value={valueProp}
          onApply={onApply}
          onClose={handleClose}
        />
      }
      placement="bottom-start"
    />
  );
}

export { LiquidityFilterControl };
