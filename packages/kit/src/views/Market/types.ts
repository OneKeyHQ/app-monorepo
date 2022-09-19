import { Token as TokenType } from '@onekeyhq/engine/src/types/token';

export type CommonPriceCardProps = {
  onPress?: () => void;
  token: TokenType;
};
