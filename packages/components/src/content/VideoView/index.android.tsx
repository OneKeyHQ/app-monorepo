import { ResizeMode, Video } from 'expo-av';

export function VideoView({ source }: { source: number }) {
  return (
    <Video
      style={{
        flex: 1,
      }}
      videoStyle={{
        width: '100%',
        height: '100%',
      }}
      resizeMode={ResizeMode.COVER}
      shouldPlay
      isLooping
      source={source}
    />
  );
}
