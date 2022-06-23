import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { AVPlaybackStatus, Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

import {
  Box,
  Center,
  Icon,
  Pressable,
  Spinner,
  ZStack,
} from '@onekeyhq/components';

import NFTImage from './NFTImage';
import { NFTProps } from './type';

const NFTAudio: FC<NFTProps> = ({ asset, width, height }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [status, setStatus] = useState<AVPlaybackStatus>();
  const [isPlaying, setIsPlaying] = useState<boolean | null>(null);
  const url = useMemo(
    () => asset.animationUrl ?? asset.imageUrl,
    [asset.animationUrl, asset.imageUrl],
  );

  async function play() {
    if (asset.animationUrl) {
      if (sound === null) {
        const { sound: playObject, status: playStatus } =
          await Audio.Sound.createAsync({
            uri: url as string,
          });
        setSound(playObject);
        setStatus(playStatus);
        await playObject.playAsync();
        setIsPlaying(true);
      } else if (status?.isLoaded && !isPlaying) {
        await sound.playAsync();
        setIsPlaying(true);
      }
    }
  }

  async function pause() {
    if (sound && status?.isLoaded && isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  }

  const createSound = useCallback(async () => {
    if (sound === null) {
      const { sound: playObject, status: playStatus } =
        await Audio.Sound.createAsync({
          uri: url as string,
        });
      setSound(playObject);
      setStatus(playStatus);
      setIsPlaying(false);
    }
  }, [sound, url]);

  useEffect(() => {
    createSound();
  }, [createSound]);

  useEffect(
    () => () => {
      if (sound) {
        sound.stopAsync();
      }
    },
    [sound],
  );
  return (
    <Box>
      <ZStack>
        <NFTImage asset={asset} width={width} height={height} />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
          style={{ left: 0, bottom: 0, width, height: 108 }}
        />
        <Center bottom={0} right={0} size="96px">
          {isPlaying === null ? (
            <Spinner size="sm" />
          ) : (
            <Pressable
              onPress={() => {
                if (isPlaying) {
                  pause();
                } else {
                  play();
                }
              }}
            >
              <Icon
                name={isPlaying ? 'PauseSolid' : 'PlaySolid'}
                size={53}
                color="text-on-primary"
              />
            </Pressable>
          )}
        </Center>
      </ZStack>
    </Box>
  );
};

export default NFTAudio;
