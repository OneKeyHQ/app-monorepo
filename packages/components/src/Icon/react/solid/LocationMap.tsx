import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLocationMap = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5.5 3A3.5 3.5 0 0 0 2 6.5v11A3.5 3.5 0 0 0 5.5 21H18a3 3 0 0 0 3-3v-4a1 1 0 1 0-2 0v4a1 1 0 0 1-1 1H5.5a1.5 1.5 0 0 1 0-3H7a1 1 0 0 0 1-1V8h2a1 1 0 1 0 0-2H8V4a1 1 0 0 0-1-1H5.5Z"
    />
    <Path
      fill="currentColor"
      d="M17 12.01c-.16 0-.31-.04-.45-.11S13 10.09 13 7.01c0-2.21 1.79-4 4-4s4 1.79 4 4c0 3.08-3.41 4.82-3.55 4.89-.14.07-.29.11-.45.11Z"
    />
  </Svg>
);
export default SvgLocationMap;
