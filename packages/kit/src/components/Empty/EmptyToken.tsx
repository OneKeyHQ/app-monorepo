import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type {
  IIconProps,
  ISizableTextProps,
  IStackProps,
} from '@onekeyhq/components';
import { Empty, Icon, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps = {
  isBuyTokenSupported?: boolean;
  onBuy?: () => void;
  onReceive?: () => void;
  withBuyAndReceive?: boolean;
};

function EmptyTokenItem({
  content,
  onPress,
  iconProps,
  textProps,
  ...rest
}: {
  content: string;
  tableLayout?: boolean;
  onPress?: () => void;
  iconProps?: IIconProps;
  textProps?: ISizableTextProps;
} & IStackProps) {
  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      p="$4"
      space="$3"
      bg="$bgSubdued"
      userSelect="none"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineOffset: 2,
      }}
      onPress={onPress}
      {...rest}
    >
      <Icon {...iconProps} />
      <SizableText size="$bodyLgMedium" {...textProps}>
        {content}
      </SizableText>
    </Stack>
  );
}

function EmptyToken(props: IProps) {
  const { onBuy, onReceive, isBuyTokenSupported, withBuyAndReceive } = props;
  const intl = useIntl();

  if (withBuyAndReceive) {
    return (
      <Stack mt="$2" px="$5" space="$4">
        {isBuyTokenSupported ? (
          <EmptyTokenItem
            bg="$purple2"
            borderColor="$purple3"
            content={intl.formatMessage({
              id: ETranslations.wallet_buy_crypto_instruction,
            })}
            onPress={onBuy}
            iconProps={{
              name: 'PlusCircleSolid',
              color: '$purple9',
            }}
            textProps={{
              color: '$purple12',
            }}
            hoverStyle={{
              bg: '$purple3',
            }}
            pressStyle={{
              bg: '$purple4',
            }}
          />
        ) : null}

        <EmptyTokenItem
          bg="$info2"
          borderColor="$info3"
          content={intl.formatMessage({
            id: ETranslations.wallet_receive_token_instruction,
          })}
          onPress={onReceive}
          iconProps={{
            name: 'ArrowBottomCircleSolid',
            color: '$info9',
          }}
          textProps={{
            color: '$info12',
          }}
          hoverStyle={{
            bg: '$info3',
          }}
          pressStyle={{
            bg: '$info4',
          }}
        />
      </Stack>
    );
  }

  return (
    <Empty
      testID="Wallet-No-Token-Empty"
      icon="CryptoCoinOutline"
      title={intl.formatMessage({ id: ETranslations.send_no_token_message })}
    />
  );

  // TODO: App review mode
}

export { EmptyToken };
