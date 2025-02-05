import { Input, SizableText, useMedia } from '@onekeyhq/components';

const LimitRateInput = ({ currency }: { currency: string }) => {
  console.log('LimitRateInput');
  const media = useMedia();
  return (
    <>
      <Input w="310px" />
      <SizableText
        position="absolute"
        right="$3"
        bottom={media.gtMd ? '$2' : '$3'}
      >
        {currency}
      </SizableText>
    </>
  );
};

export default LimitRateInput;
