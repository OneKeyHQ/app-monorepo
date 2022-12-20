import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { Audio } from 'expo-av';

import {
  Box,
  Center,
  Icon,
  NetImage,
  Pressable,
  Spinner,
} from '@onekeyhq/components';

import type { AVPlaybackStatus } from 'expo-av';

type Props = {
  size: number;
  url: string;
  poster?: string;
};

const NFTAudio: FC<Props> = ({ url, size, poster }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [status, setStatus] = useState<AVPlaybackStatus>();
  const [isPlaying, setIsPlaying] = useState<boolean | null>(null);
  async function play() {
    if (url) {
      if (sound === null) {
        const { sound: playObject, status: playStatus } =
          await Audio.Sound.createAsync({
            uri: url,
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
    if (sound === null && url) {
      const { sound: playObject, status: playStatus } =
        await Audio.Sound.createAsync({
          uri: url,
        });
      setSound(playObject);
      setStatus(playStatus);
      setIsPlaying(false);
    }
  }, [url, sound]);

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
    <Box size={`${size}px`}>
      <NetImage src={poster} width={size} height={size} />
      <Center position="absolute" bottom={0} right={0} size="96px">
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
              name={isPlaying ? 'PauseMini' : 'PlayMini'}
              size={53}
              color="text-on-primary"
            />
          </Pressable>
        )}
      </Center>
    </Box>
  );
};

export default NFTAudio;
