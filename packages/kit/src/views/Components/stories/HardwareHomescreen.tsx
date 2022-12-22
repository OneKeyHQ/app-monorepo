import type { FC } from 'react';
import { memo, useEffect, useState } from 'react';

import {
  Box,
  Button,
  Image,
  Pressable,
  ScrollView,
  Stack,
  Typography,
} from '@onekeyhq/components';
import { T1Data } from '@onekeyhq/kit/src/utils/hardware/constants/homescreensData';
import { elementToHomescreen } from '@onekeyhq/kit/src/utils/hardware/homescreens';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigationBack } from '../../../hooks/useAppNavigation';

type DataItem = { name: string; staticPath: any };

const GenerateHomescreen: FC = () => {
  const [data, setData] = useState<DataItem[]>([]);

  useEffect(() => {
    const dataSource = Object.values(T1Data).map((item) => item);
    setData(dataSource);
  }, []);

  const handleClick = (imageId: string) => {
    const element = document.getElementById(imageId);
    if (element instanceof HTMLImageElement) {
      const hex = elementToHomescreen(element);
      // serviceHardware.applySettings('Bixin21042003983', { homescreen: hex });
      const imageData = {
        name: imageId,
        staticPath: `require('@onekeyhq/kit/assets/hardware/homescreens/t1/${imageId}.png')`,
        hex,
      };
      console.log(JSON.stringify(imageData));
    }
  };

  const generateAllData = () => {
    const allData: any = {};
    Object.entries(T1Data).forEach(([name]) => {
      const element = document.getElementById(name);
      if (element instanceof HTMLImageElement) {
        const hex = elementToHomescreen(element);
        const imageData = {
          name,
          staticPath: `require('@onekeyhq/kit/assets/hardware/homescreens/t1/${name}.png')`,
          hex,
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        allData[name] = imageData;
      }
    });

    console.log(JSON.stringify(allData));
  };

  return (
    <Box>
      <Typography.Body1Strong>Generate Homescreen Hex</Typography.Body1Strong>
      <Button onPress={generateAllData}>Generate All Data</Button>
      <Stack
        alignItems="center"
        justifyContent="space-between"
        flexDirection="row"
        flexWrap="wrap"
        space={3}
      >
        {data.map((item) => (
          <Pressable key={item.name} width={16} height={16} mb={4}>
            <Box flex={1} height={16}>
              {/* only support on browser */}
              {platformEnv.isNative ? (
                <Image
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  source={item.staticPath}
                  resizeMode="contain"
                  size={16}
                  height={16}
                  borderRadius="12px"
                  borderColor="interactive-default"
                  bgColor="#000"
                />
              ) : (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                <img
                  src={item.staticPath}
                  alt={item.name}
                  id={item.name}
                  onClick={() => handleClick(item.name)}
                />
              )}
            </Box>
          </Pressable>
        ))}
      </Stack>
    </Box>
  );
};

const HomescreenSetting = () => {
  const goBack = useNavigationBack();
  return (
    <ScrollView p={4} flex="1" bg="background-hovered">
      <Button onPress={goBack}>Back to HOME</Button>
      <GenerateHomescreen />
    </ScrollView>
  );
};
export default memo(HomescreenSetting);
