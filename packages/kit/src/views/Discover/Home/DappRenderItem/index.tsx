import { type FC, type ReactElement, cloneElement, useCallback } from 'react';

import { Box, Center, Typography } from '@onekeyhq/components';
import { NetworkIconGroup } from '@onekeyhq/kit/src/components/NetworkIconGroup';

import DAppIcon from '../../components/DAppIcon';
import { openMatchDApp } from '../../Explorer/Controller/gotoSite';
import { DappItemPlainLayout } from '../DappRenderLayout';
import { Pressable } from '../Pressable';

type DappRenderItemProps = {
  title: string;
  logoURI: string;
  url: string;
  description?: string;
  networkIds?: string[];
  dappId?: string;
};

const handlePress = (props: DappRenderItemProps) => {
  if (props.dappId) {
    openMatchDApp({
      id: props.dappId,
      dapp: {
        _id: props.dappId,
        name: props.title,
        logoURL: props.logoURI,
        url: props.url,
        subtitle: props.description || '',
        networkIds: props.networkIds || [],
      },
      isNewWindow: true,
    });
  } else {
    openMatchDApp({
      id: props.url,
      webSite: {
        url: props.url,
        favicon: props.logoURI,
        title: props.title,
      },
      isNewWindow: true,
    });
  }
};

export const DappItemOutline: FC<DappRenderItemProps> = (props) => {
  const { title, description, logoURI, networkIds } = props;
  const onPress = useCallback(() => {
    handlePress(props);
  }, [props]);
  return (
    <Pressable
      p="4"
      w="152px"
      h="204"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      borderRadius={12}
      borderWidth={0.5}
      borderColor="border-subdued"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
      onPress={onPress}
    >
      <Center mb="4">
        <DAppIcon url={logoURI} size={48} />
      </Center>
      <Typography.Body2Strong textAlign="center" numberOfLines={1}>
        {title}
      </Typography.Body2Strong>
      <Box pt="1" pb="4">
        <NetworkIconGroup networkIds={networkIds ?? []} />
      </Box>
      <Box flex="1" w="full">
        <Typography.Caption
          w="full"
          numberOfLines={3}
          textAlign="center"
          color="text-subdued"
        >
          {description ?? ''}
        </Typography.Caption>
      </Box>
    </Pressable>
  );
};

type DappItemPlainProps = DappRenderItemProps & {
  rightElement?: ReactElement;
};

export const DappItemPlain: FC<DappItemPlainProps> = (props) => {
  const { title, description, logoURI, networkIds, rightElement } = props;
  const onPress = useCallback(() => {
    handlePress(props);
  }, [props]);
  return (
    <DappItemPlainLayout>
      <Pressable
        w="full"
        flexDirection="row"
        _hover={{ bgColor: 'surface-hovered' }}
        _pressed={{ bgColor: 'surface-pressed' }}
        p="2"
        borderRadius={12}
        onPress={onPress}
        justifyContent="space-between"
        alignItems="center"
      >
        {({ isPressed }) => (
          <>
            <Box flex="1" flexDirection="row">
              <Box mr="4">
                <DAppIcon url={logoURI} size={48} />
              </Box>
              <Box flex="1">
                <Typography.Body1Strong numberOfLines={1}>
                  {title}
                </Typography.Body1Strong>
                <Typography.Body2 color="text-subdued" numberOfLines={2}>
                  {description}
                </Typography.Body2>
                <NetworkIconGroup networkIds={networkIds ?? []} />
              </Box>
            </Box>
            <Box>
              {rightElement ? cloneElement(rightElement, { isPressed }) : null}
            </Box>
          </>
        )}
      </Pressable>
    </DappItemPlainLayout>
  );
};
