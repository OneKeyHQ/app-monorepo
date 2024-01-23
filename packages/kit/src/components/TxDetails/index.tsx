import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons, ILocaleIds } from '@onekeyhq/components';
import {
  Button,
  DescriptionList,
  Image,
  Stack,
  XStack,
} from '@onekeyhq/components';

export type ITxDetailsProps = {
  details: {
    key: ILocaleIds;
    value?: string;
    iconAfter?: IKeyOfIcons;
    onPress?: () => void;
    imgUrl?: string;
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
            <DescriptionList.Item key={item.key}>
              <DescriptionList.Item.Key>
                {intl.formatMessage({ id: item.key })}
              </DescriptionList.Item.Key>
              <XStack alignItems="center">
                {item.imgUrl && (
                  <Image
                    width="$5"
                    height="$5"
                    source={{
                      uri: item.imgUrl,
                    }}
                    mr="$1.5"
                  />
                )}
                <DescriptionList.Item.Value
                  iconAfter={item.iconAfter}
                  onPress={item.onPress}
                >
                  {item.value}
                </DescriptionList.Item.Value>
              </XStack>
            </DescriptionList.Item>
          ))}
        </DescriptionList>
      ))}
      {isUTXO && (
        <Stack mt="$5" mx="$5">
          <Button size="medium" onPress={() => onViewUTXOsPress?.()}>
            {intl.formatMessage({ id: 'form__view_inputs_outputs' })}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

export { TxDetails };
