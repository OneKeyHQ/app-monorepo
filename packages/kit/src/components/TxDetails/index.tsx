import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { DescriptionList, Image, XStack } from '@onekeyhq/components';

export type IProps = {
  details: {
    key: string;
    value?: string;
    iconAfter?: IKeyOfIcons;
    onPress?: () => void;
    imgUrl?: string;
  }[][];
};

function TxDetails(props: IProps) {
  const { details } = props;
  return (
    <>
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
              <DescriptionList.Item.Key>{item.key}</DescriptionList.Item.Key>
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
    </>
  );
}

export { TxDetails };
