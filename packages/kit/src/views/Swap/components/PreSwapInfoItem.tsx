import { SizableText, XStack } from '@onekeyhq/components';

interface IPreSwapInfoItemProps {
  title: string;
  value: string;
}

const PreSwapInfoItem = ({ title, value }: IPreSwapInfoItemProps) => {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {title}
      </SizableText>
      <SizableText size="$bodyMd">{value}</SizableText>
    </XStack>
  );
};

export default PreSwapInfoItem;
