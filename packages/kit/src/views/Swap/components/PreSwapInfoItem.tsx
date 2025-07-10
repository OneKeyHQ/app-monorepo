import { SizableText, XStack } from '@onekeyhq/components';

interface IPreSwapInfoItemProps {
  title: string;
  value: string | React.ReactNode;
}

const PreSwapInfoItem = ({ title, value }: IPreSwapInfoItemProps) => {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {title}
      </SizableText>
      {typeof value === 'string' ? (
        <SizableText size="$bodyMd">{value}</SizableText>
      ) : (
        value
      )}
    </XStack>
  );
};

export default PreSwapInfoItem;
