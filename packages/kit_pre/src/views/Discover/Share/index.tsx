import { useCallback, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';

import {
  Box,
  Button,
  Divider,
  Modal,
  QRCode,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import LogoPrimary from '@onekeyhq/components/src/Icon/react/illus/LogoPrimary';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { DiscoverModalRoutes, DiscoverRoutesParams } from '../type';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  DiscoverRoutesParams,
  DiscoverModalRoutes.ShareModal
>;

const logo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJwAAACcCAMAAAC9ZjJ/AAAAllBMVEUAAAAAuBIAtxAAuBMAtxIAuRIAtxMAuRIAtxIAtxIAuBIAuBMAuBEAsxAAtxIAtxIAuBIAuRIAuBIAuBL///8AtRIAtxIAsxKA2ojf9uG/7cRg0WsgvzCg5Kbv+/BAyk2v6LUQvSFw13pAxk0wxT/P8dMQuiEQtyHv+vBw1HpQzFyQ3Zcwwj6Q4JiQ35fP8tOQ35iP35ce/Hr/AAAAE3RSTlMA3yC/QO9gsJCAz1AwENCgn39wIDfjZgAABGxJREFUeNrtnNlS4zAQReV4zcYALcmWF7ITwjDb///c2BCQwImdcTt2ZyqH5SGVh1NXaklxSs3qmE68wB9ZLrSJZfvBvcNwOHe2C+fDHjrNzVw4O9btoImaDR1he+zf8CzoEMsjmdqH3pidxtSHHjht7o0RZXDusQ2gN+5YNYMb6JHRoNLNgl6xKuwmCLdz2w1c6B13QnNM37Oj63bE7gaIMGIl7oAMQWmnB0KMaU64N9wpM/kGpPCZwRiI4TANqUEtsIlWwxse3eAALMLB6VlnA0Hs/RoHJHEornHvDKmWQ4HLchwgSjGuQyDKkGqtvtcrUMWd0p1yABN2D2TxWABkCZgPOBQvE0Er+NhinfFDcgLaYITdH7LDchJawGKAQ51RzkXKzfgZ5QApl1GWU4flQgpyM044uYyynOJ0h3Uda+glJ4UQYYEIySX3aielKKCXnEYSTE5DOTm4JncyV7mmXOWacrFy16WkimtyTbnKNeVi5xxpOdLDepX7BxKDF2pyIEUocsL8P9atfTmQbwDkf+1A92uIduUW61nyPFsvAEnrcovlXPE9v+ZJCghalpvF/AvZDHDg5bRamTiVgAQvl8b8CH8WOD283OyBH0WlgAAvt+RVPD0jskPLRbyGBGGHlFvyWl4Qdii5Na/nKRXQALRcqvgJxIhTAEIu4594yHbP6ctqN8d/KYGXSz+r7bZhKF5JI/VpYB97kIu5wfdtYSYl5D+53hwRHVKuXA1Rnpo+xUkpok/RCWgARi776gYGUvxGRIeXM7atLCwfzEWMKFis3MzcQvPcKoe9wVqHkvthDqqQ1eOeNIgOIxcbuYSyJtusYzk95WId3LG3bMJu5YwlLhRwEL3YqVDAyeDlUmNCHYvlJ/+gRzk4TERBTki6cjsh61abp27lwNwfZN1qszEKuh68nKotxYX2jztOzjgUrQQcIjFWm47llrX7uuIfPHe8Q6y5ZiWrg+PbjuXMYNSBg3hqHKnmYddyEddsHmXVJ7Mk7PjIBIsH0y6VJTfEzoqWkxE3UIk09JamOE+6ltPRab3F/vWl4iYq7EGu/KQknmdZpvgX0rDbj4Z6Ia4nauSGl1soXkt8wqBi5DCPctQW4YaSq7dTiAmHlpPVdvEW4YaWA/n4s6oWcG7AXEAhRaKOxLbCugH6Spo8rKeSXE0ACouNAI0QSfzlIeeqUJOAw8Zdc9HpPa6i+UblbLLdavuamgQkfjsXhGSuJ0S4Z/+QE03APMCi4yvQYmju2QTaQxa/7eGwKYE+IEegfhGS9BVSsjchHZZDdNJZjNEd11tG+FL1gH6TAZrReZfQ2IJiZ4siOKqtLV6DozrrxszAB1LcMgNiZ5Oi4xbZ/kIeoXaC5eNIiREQ4ebSWrwRsTPdTCYEStYdUG0WCWBNLrOVZW7Xa83eVLj1fWgPqLUS1rhjdgKDb9AD/pSdxrjz8Gzn/2gTXeDZgACdWv3c6yA+F9E6fXjO/Fw7N8Ph3Ae+bbVrZY38wJvU1udfiwGx6zsgLxcAAAAASUVORK5CYII=';

export const ShareView = () => {
  const ref = useRef<ViewShot | null>(null);

  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { url } = route.params;
  const name = route.params.name ?? '';
  const { logoURL } = route.params;

  const onCapture = useCallback(async () => {
    if (!platformEnv.isNative) return null;
    const share = (
      await import('@onekeyhq/shared/src/modules3rdParty/react-native-share')
    ).default;
    const uri = await ref.current?.capture?.();
    if (!share || !uri) {
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__unknown_error' }),
      });
      return;
    }
    const options = Platform.select({
      ios: {
        activityItemSources: [
          {
            placeholderItem: { type: 'url' as const, content: logo },
            item: {
              default: { type: 'url' as const, content: `file://${uri}` },
            },
            linkMetadata: {
              title: 'Share',
            },
          },
        ],
        failOnCancel: true,
      },
      default: {
        url: `file://${uri}`,
        title: 'Share',
        filename: 'onekey_share.png',
        failOnCancel: true,
      },
    });
    await share.open(options).catch(() => {
      console.log('user cancel share');
    });
  }, [ref, intl]);

  const onCopy = useCallback(() => {
    copyToClipboard(url);
    ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [intl, url]);

  const props = useMemo(
    () =>
      logoURL
        ? {
            logoSize: 50,
            logoMargin: 10,
            logo: { uri: logoURL },
          }
        : {
            logoSize: 0,
            logoMargin: 0,
          },
    [logoURL],
  );

  return (
    <Modal
      hideSecondaryAction
      primaryActionTranslationId="title__share"
      primaryActionProps={{
        onPress: onCapture,
        leftIconName: 'ShareMini',
        size: 'xl',
        type: 'basic',
        width: 'full',
      }}
      header={intl.formatMessage({ id: 'title__share' })}
      scrollViewProps={{
        children: (
          <Box alignItems="center" h="full">
            <ViewShot ref={ref}>
              <Box p="6" bg="background-default">
                <Box
                  borderWidth="1"
                  borderColor="border-default"
                  p="6"
                  borderRadius={48}
                  alignItems="center"
                  backgroundColor="surface-subdued"
                >
                  <Box bg="white" p="6" borderRadius={24}>
                    <QRCode
                      value={url || 'https://onekey.so/download'}
                      size={256}
                      logoBackgroundColor="white"
                      {...props}
                    />
                  </Box>
                  <Typography.DisplayMedium mt="6" color="text-default">
                    {name}
                  </Typography.DisplayMedium>
                  <Typography.Body1
                    mt="2"
                    color="text-subdued"
                    textAlign="center"
                  >
                    {url}
                  </Typography.Body1>
                  <Divider
                    color="divider"
                    w="64"
                    orientation="horizontal"
                    my="6"
                  />
                  <Box flexDirection="row" alignItems="center">
                    <Typography.Body2
                      mr="3"
                      color="text-default"
                      fontWeight={500}
                    >
                      Share With
                    </Typography.Body2>
                    <LogoPrimary width={82} height={25} />
                  </Box>
                </Box>
              </Box>
            </ViewShot>
            <Box px="6" w="full">
              <Button
                w="full"
                type="plain"
                size="xl"
                leftIconName="Square2StackMini"
                onPress={onCopy}
              >
                {intl.formatMessage({ id: 'action__copy_url' })}
              </Button>
            </Box>
          </Box>
        ),
      }}
    />
  );
};
