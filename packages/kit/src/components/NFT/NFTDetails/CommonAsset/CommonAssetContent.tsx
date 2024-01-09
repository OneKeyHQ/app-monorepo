import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  DescriptionList,
  Divider,
  Heading,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nft: IAccountNFT;
};

function CommonAssetContent(props: IProps) {
  const intl = useIntl();
  const { nft } = props;
  const { attributes } = nft.metadata;

  const details: {
    label: string;
    value: string;
    onPress?: () => void;
    iconAfter?: IKeyOfIcons;
  }[] = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: 'content__collection' }),
        value: nft.collectionName,
      },
      {
        label: intl.formatMessage({ id: 'network__network' }),
        value: 'Ethereum',
      },
      {
        label: 'Token ID',
        value: nft.itemId,
      },
      {
        label: intl.formatMessage({ id: 'content__nft_standard' }),
        value: nft.collectionType,
      },
      {
        label: intl.formatMessage({
          id: 'transaction__contract_address',
        }),
        value: accountUtils.shortenAddress({ address: nft.collectionAddress }),
        onPress: () =>
          Toast.success({
            title: intl.formatMessage({ id: 'msg__copied' }),
          }),
        iconAfter: 'Copy1Outline',
      },
    ],
    [
      intl,
      nft.collectionAddress,
      nft.collectionName,
      nft.collectionType,
      nft.itemId,
    ],
  );

  return (
    <Stack
      px="$5"
      $gtMd={{
        flexBasis: '66.6666%',
      }}
      space="$5"
    >
      <DescriptionList>
        {details.map(({ label, value, onPress, iconAfter }) => (
          <DescriptionList.Item key={label}>
            <DescriptionList.Item.Key size="$bodyMd" color="$textSubdued">
              {label}
            </DescriptionList.Item.Key>
            <DescriptionList.Item.Value onPress={onPress} iconAfter={iconAfter}>
              {value}
            </DescriptionList.Item.Value>
          </DescriptionList.Item>
        ))}
      </DescriptionList>
      {/* Attributes */}
      <Divider />
      <Stack>
        <Heading size="$headingSm">Attributes</Heading>
        <XStack m="$-1" pt="$2.5" flexWrap="wrap">
          {attributes?.map(({ traitType, value }) => (
            <Stack
              key={traitType}
              py="$2"
              px="$3.5"
              m="$1"
              bg="$bgStrong"
              borderRadius="$2"
              style={{
                borderCurve: 'continuous',
              }}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {traitType}
              </SizableText>
              <SizableText size="$bodyMdMedium">{value}</SizableText>
            </Stack>
          ))}
        </XStack>
      </Stack>
    </Stack>
  );
}

export { CommonAssetContent };
