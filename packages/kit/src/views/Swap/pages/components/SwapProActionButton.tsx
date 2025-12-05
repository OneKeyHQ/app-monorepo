import { Button, SizableText } from '@onekeyhq/components';

interface ISwapProActionButtonProps {
  onSwapProActionClick: () => void;
}

const SwapProActionButton = ({
  onSwapProActionClick,
}: ISwapProActionButtonProps) => {
  return (
    <Button onPress={onSwapProActionClick}>
      <SizableText>action</SizableText>
    </Button>
  );
};

export default SwapProActionButton;
