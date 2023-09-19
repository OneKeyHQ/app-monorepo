import { useEffect, useRef } from 'react';

import { useRoute } from '@react-navigation/native';
import { Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { Box, Modal, QRCode, Typography } from '@onekeyhq/components';
import LogoPrimary from '@onekeyhq/components/src/Icon/react/illus/LogoPrimary';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../../hooks';
import Transaction from '../components/Transaction';
import { useWalletsSwapTransactions } from '../hooks/useTransactions';

import type { SwapRoutes, SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.Transaction>;

const getShareModule = async () => {
  if (!platformEnv.isNative) return null;
  return (
    await import('@onekeyhq/shared/src/modules3rdParty/react-native-share')
  ).default;
};

const logo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJwAAACcCAMAAAC9ZjJ/AAAAllBMVEUAAAAAuBIAtxAAuBMAtxIAuRIAtxMAuRIAtxIAtxIAuBIAuBMAuBEAsxAAtxIAtxIAuBIAuRIAuBIAuBL///8AtRIAtxIAsxKA2ojf9uG/7cRg0WsgvzCg5Kbv+/BAyk2v6LUQvSFw13pAxk0wxT/P8dMQuiEQtyHv+vBw1HpQzFyQ3Zcwwj6Q4JiQ35fP8tOQ35iP35ce/Hr/AAAAE3RSTlMA3yC/QO9gsJCAz1AwENCgn39wIDfjZgAABGxJREFUeNrtnNlS4zAQReV4zcYALcmWF7ITwjDb///c2BCQwImdcTt2ZyqH5SGVh1NXaklxSs3qmE68wB9ZLrSJZfvBvcNwOHe2C+fDHjrNzVw4O9btoImaDR1he+zf8CzoEMsjmdqH3pidxtSHHjht7o0RZXDusQ2gN+5YNYMb6JHRoNLNgl6xKuwmCLdz2w1c6B13QnNM37Oj63bE7gaIMGIl7oAMQWmnB0KMaU64N9wpM/kGpPCZwRiI4TANqUEtsIlWwxse3eAALMLB6VlnA0Hs/RoHJHEornHvDKmWQ4HLchwgSjGuQyDKkGqtvtcrUMWd0p1yABN2D2TxWABkCZgPOBQvE0Er+NhinfFDcgLaYITdH7LDchJawGKAQ51RzkXKzfgZ5QApl1GWU4flQgpyM044uYyynOJ0h3Uda+glJ4UQYYEIySX3aielKKCXnEYSTE5DOTm4JncyV7mmXOWacrFy16WkimtyTbnKNeVi5xxpOdLDepX7BxKDF2pyIEUocsL8P9atfTmQbwDkf+1A92uIduUW61nyPFsvAEnrcovlXPE9v+ZJCghalpvF/AvZDHDg5bRamTiVgAQvl8b8CH8WOD283OyBH0WlgAAvt+RVPD0jskPLRbyGBGGHlFvyWl4Qdii5Na/nKRXQALRcqvgJxIhTAEIu4594yHbP6ctqN8d/KYGXSz+r7bZhKF5JI/VpYB97kIu5wfdtYSYl5D+53hwRHVKuXA1Rnpo+xUkpok/RCWgARi776gYGUvxGRIeXM7atLCwfzEWMKFis3MzcQvPcKoe9wVqHkvthDqqQ1eOeNIgOIxcbuYSyJtusYzk95WId3LG3bMJu5YwlLhRwEL3YqVDAyeDlUmNCHYvlJ/+gRzk4TERBTki6cjsh61abp27lwNwfZN1qszEKuh68nKotxYX2jztOzjgUrQQcIjFWm47llrX7uuIfPHe8Q6y5ZiWrg+PbjuXMYNSBg3hqHKnmYddyEddsHmXVJ7Mk7PjIBIsH0y6VJTfEzoqWkxE3UIk09JamOE+6ltPRab3F/vWl4iYq7EGu/KQknmdZpvgX0rDbj4Z6Ia4nauSGl1soXkt8wqBi5DCPctQW4YaSq7dTiAmHlpPVdvEW4YaWA/n4s6oWcG7AXEAhRaKOxLbCugH6Spo8rKeSXE0ACouNAI0QSfzlIeeqUJOAw8Zdc9HpPa6i+UblbLLdavuamgQkfjsXhGSuJ0S4Z/+QE03APMCi4yvQYmju2QTaQxa/7eGwKYE+IEegfhGS9BVSsjchHZZDdNJZjNEd11tG+FL1gH6TAZrReZfQ2IJiZ4siOKqtLV6DozrrxszAB1LcMgNiZ5Oi4xbZ/kIeoXaC5eNIiREQ4ebSWrwRsTPdTCYEStYdUG0WCWBNLrOVZW7Xa83eVLj1fWgPqLUS1rhjdgKDb9AD/pSdxrjz8Gzn/2gTXeDZgACdWv3c6yA+F9E6fXjO/Fw7N8Ph3Ae+bbVrZY38wJvU1udfiwGx6zsgLxcAAAAASUVORK5CYII=';

const Share = () => {
  const ref = useRef<ViewShot | null>(null);
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const transactions = useWalletsSwapTransactions();
  const tx = transactions.find((s) => s.hash === route.params.txid);

  useEffect(() => {
    async function onCapture() {
      const uri = await ref.current?.capture?.();
      if (uri) {
        const share = await getShareModule();
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
        if (!share) return;
        await share.open(options).catch(() => {
          console.log('something wrong');
        });
        navigation.goBack();
      }
    }
    const timer = setTimeout(onCapture, 1000);
    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!tx) {
    return null;
  }

  return (
    <Modal footer={null} staticChildrenProps={{}}>
      <Box w="full" h="full" position="relative">
        <ViewShot ref={ref}>
          <Box px={{ base: 4, md: 6 }} py="6" bg="surface-subdued">
            <Transaction tx={tx} />
            <Box
              mt="8"
              display="flex"
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Box>
                <LogoPrimary width={82} height={25} />
                <Typography.Caption mt="2" color="text-subdued">
                  All-in-one crypto wallet
                </Typography.Caption>
              </Box>
              <Box bg="white" p="1" borderRadius={4} shadow="depth.4">
                <QRCode
                  value="https://onekey.so/download"
                  size={64}
                  logoSize={0}
                  logoMargin={0}
                  logoBackgroundColor="white"
                />
              </Box>
            </Box>
          </Box>
        </ViewShot>
        <Box position="absolute" top="0" left="0" w="full" h="full" />
      </Box>
    </Modal>
  );
};

export default Share;
