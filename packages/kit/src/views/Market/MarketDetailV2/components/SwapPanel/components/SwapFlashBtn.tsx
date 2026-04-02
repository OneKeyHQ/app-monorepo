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
      w="$9"
      h="$9"
      p="$0"
      borderRadius="$full"
      onPress={onFlashTrade}
      justifyContent="center"
      alignItems="center"
      {...buttonProps}
    >
      <Icon name="FlashSolid" size="$5" color="$iconInverse" />
    </Button>
  );
};

export default SwapFlashBtn;
