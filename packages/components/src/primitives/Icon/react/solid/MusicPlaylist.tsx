import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMusicPlaylist = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M17.71 4.73a1 1 0 0 1 1.288.958v6.783a4.49 4.49 0 0 0-2-.471c-2.03 0-4 1.404-4 3.5s1.97 3.5 4 3.5c2.03 0 4-1.404 4-3.5V5.688a3 3 0 0 0-3.862-2.873l-6 1.8a3 3 0 0 0-2.138 2.873v7.983a4.49 4.49 0 0 0-2-.471c-2.03 0-4 1.404-4 3.5s1.97 3.5 4 3.5c2.03 0 4-1.404 4-3.5V7.488a1 1 0 0 1 .713-.958l6-1.8Z"
    />
  </Svg>
);
export default SvgMusicPlaylist;
