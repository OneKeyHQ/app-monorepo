import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlaylist = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M21.998 5a1 1 0 1 0-2 0v9.471a4.488 4.488 0 0 0-2-.471c-2.03 0-4 1.404-4 3.5s1.97 3.5 4 3.5c2.03 0 4-1.404 4-3.5V5ZM3 5a1 1 0 0 0 0 2h13a1 1 0 1 0 0-2H3Zm0 6a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H3Zm0 6a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H3Z"
    />
  </Svg>
);
export default SvgPlaylist;
