import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMusicPlaylist = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.998 18.5c0 1.38-1.343 2.5-3 2.5s-3-1.12-3-2.5 1.343-2.5 3-2.5 3 1.12 3 2.5Zm0 0V7.488a2 2 0 0 1 1.425-1.916l6-1.8a2 2 0 0 1 2.575 1.916V15.5m0 0c0 1.38-1.343 2.5-3 2.5s-3-1.12-3-2.5 1.343-2.5 3-2.5 3 1.12 3 2.5Z"
    />
  </Svg>
);
export default SvgMusicPlaylist;
