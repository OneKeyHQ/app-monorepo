import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChromecast = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M3 14a6 6 0 0 1 6 6M3 10c5.523 0 10 4.477 10 10m4 0h2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2m0 12a2 2 0 0 1 2 2"
    />
  </Svg>
);
export default SvgChromecast;
