import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  DescriptionList,
  Image,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { ILocaleIds } from '@onekeyhq/shared/src/locale';

export type ITxDetailsProps = {
  details: {
    key: ILocaleIds;
    value?: string;
    iconAfter?: IKeyOfIcons;
    onPress?: () => void;
    imgUrl?: string;
    isNFT?: boolean;
  }[][];
  isUTXO?: boolean;
  onViewUTXOsPress?: () => void;
};

function TxDetails(props: ITxDetailsProps) {
  const { details, isUTXO, onViewUTXOsPress } = props;
  const intl = useIntl();
  return (
    <Stack>
      {details.map((section, index) => (
        <DescriptionList
          mx="$5"
          key={index}
          {...(index !== 0 && {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: '$borderSubdued',
            mt: '$4',
            pt: '$4',
          })}
        >
          {section.map((item) => (
            <DescriptionList.Item
              key={item.key}
              space="$5"
              alignItems="flex-start"
            >
              <DescriptionList.Item.Key>
                {intl.formatMessage({ id: item.key })}
              </DescriptionList.Item.Key>
              <XStack
                alignItems="center"
                flex={1}
                flexWrap="wrap"
                justifyContent="flex-end"
              >
                {item.imgUrl ? (
                  <Image
                    width="$5"
                    height="$5"
                    source={{
                      uri: item.imgUrl,
                    }}
                    circular={!item.isNFT}
                    borderRadius={3}
                    mr="$1.5"
                  />
                ) : null}
                <DescriptionList.Item.Value
                  flex={item.imgUrl ? 0 : 1}
                  iconAfter={item.iconAfter}
                  onPress={item.onPress}
                  textProps={{
                    flex: 1,
                    numberOfLines: 2,
                    alignContent: 'flex-start',
                  }}
                >
                  {item.value}
                </DescriptionList.Item.Value>
              </XStack>
            </DescriptionList.Item>
          ))}
        </DescriptionList>
      ))}
      {isUTXO ? (
        <Stack mt="$5" mx="$5">
          <Button size="medium" onPress={() => onViewUTXOsPress?.()}>
            {intl.formatMessage({ id: 'form__view_inputs_outputs' })}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}

export { TxDetails };
