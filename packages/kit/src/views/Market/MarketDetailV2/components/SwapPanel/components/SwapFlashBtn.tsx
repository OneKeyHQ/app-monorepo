import type { IButtonProps } from '@onekeyhq/components';
import { Button, Icon } from '@onekeyhq/components';

interface ISwapFlashBtnProps {
  onFlashTrade: () => void;
  buttonProps?: IButtonProps;
}

const SwapFlashBtn = ({ onFlashTrade, buttonProps }: ISwapFlashBtnProps) => {
  return (
    <Button
      size="small"
      variant="primary"
      w="$8"
      h="$8"
      p="$0"
      borderRadius="$4"
      onPress={onFlashTrade}
      justifyContent="center"
      alignItems="center"
      {...buttonProps}
    >
      <Icon name="FlashSolid" size="$4.5" color="$iconInverse" />
    </Button>
  );
};

export default SwapFlashBtn;
