import { useState } from 'react';

import {
  AnimatePresence,
  Dialog,
  Icon,
  Image,
  ScrollView,
  XStack,
  getThemeTokens,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';

import { WalletOptionItem } from './WalletOptionItem';

const DATA = new Array(53).fill(0);

export function HomeScreen() {
  const [selectedScreenIndex, setSelectedScreenIndex] = useState(-1);

  return (
    <WalletOptionItem
      icon="AiImagesOutline"
      label="Homescreen"
      onPress={() =>
        Dialog.show({
          title: 'Homescreen',
          renderContent: (
            <ScrollView mx="$-5" maxHeight="$96">
              <XStack flexWrap="wrap" px="$4" my="$-1">
                {DATA.map((item, index) => (
                  <XStack
                    key={index}
                    flexBasis="25%"
                    p="$1"
                    hoverStyle={{
                      opacity: 0.7,
                    }}
                    pressStyle={{
                      opacity: 0.5,
                    }}
                    onPress={() => {
                      setSelectedScreenIndex(index);
                    }}
                  >
                    <Image
                      flex={1}
                      w="$full"
                      source={{
                        width: 96,
                        height: 48,
                        uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAD6SURBVHgB7dpBCsJAFAXBP+L9rxwRVwmIhKxMda1dto8hM2tmtgnrMaEVAK4AcAWAKwBcAeAKAFcAuALAFQCuAHAFgCsA3HNQ27a/BF1rjagFwDELcPzH56MFwBUArgBwzBngeMrvTPDRAuAKAFcAuALAFQCuAHAFgCsAXAHg3p/H+iQGawFw3IugX3cA2sugFgDHnAHO3v4pS9AC4G6/AGdf/2qvhVsA3G0X4Oo/WVmCFgBXALgCwBUArgBwBYArAFxfAi/+/t+1ALhuA7/oNjAE7k1gL4L2WgBcr4JxLQCuAHAFgCsAXAHgCgBXALgCwBUArgBwBYB7AWZ7MHQzZwsrAAAAAElFTkSuQmCC',
                      }}
                    />
                    <AnimatePresence>
                      {selectedScreenIndex === index && (
                        <Icon
                          position="absolute"
                          right="$1.5"
                          bottom="$1.5"
                          size="$5"
                          name="CheckRadioSolid"
                          color={
                            getThemeTokens().color.$iconInverseLight
                              .val as ColorTokens
                          }
                          animation="quick"
                          enterStyle={{
                            opacity: 0,
                            scale: 0,
                          }}
                          exitStyle={{
                            opacity: 0,
                            scale: 0,
                          }}
                        />
                      )}
                    </AnimatePresence>
                  </XStack>
                ))}
              </XStack>
            </ScrollView>
          ),
        })
      }
    />
  );
}
