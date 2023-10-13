import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlaylist = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.998 17.5c0 1.38-1.343 2.5-3 2.5s-3-1.12-3-2.5 1.343-2.5 3-2.5 3 1.12 3 2.5Zm0 0V5M3 6h13M3 12h8m-8 6h6"
    />
  </Svg>
);
export default SvgPlaylist;
