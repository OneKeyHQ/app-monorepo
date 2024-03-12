import { useEffect } from 'react';

import { VideoView as Video, useVideoPlayer } from '@expo/video';
import { Image } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function VideoView({ source }: { source: number }) {
  const player = useVideoPlayer(
    platformEnv.isNative
      ? Image.resolveAssetSource(source).uri
      : (source as any),
  );

  // If the `@expo/video` had added the `autoPlay` property in the future, we can remove the entire `useEffect`
  useEffect(() => {
    player.isMuted = true;
    // On the web platform, we must add the setTimeout because of empty `mountedVideos`
    setTimeout(() => {
      player.play();
    });
  }, [player]);
  return (
    <Video
      nativeControls={false}
      allowsFullscreen={false}
      showsTimecodes={false}
      contentPosition={undefined}
      allowsPictureInPicture={false}
      startsPictureInPictureAutomatically={false}
      requiresLinearPlayback={false}
      style={{
        width: '100%',
        height: '100%',
      }}
      player={player}
      contentFit={platformEnv.isNativeAndroid ? 'fill' : 'cover'}
    />
  );
}
