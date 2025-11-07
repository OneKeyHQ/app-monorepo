import { SizableText } from '@onekeyhq/components';

export interface ICardDescriptionProps {
  description: string;
  color?: string;
}

export function CardDescription({
  description,
  color = '$textSubdued',
}: ICardDescriptionProps) {
  return (
    <SizableText mt="$0.5" size="$bodyMd" color={color}>
      {description}
    </SizableText>
  );
}
