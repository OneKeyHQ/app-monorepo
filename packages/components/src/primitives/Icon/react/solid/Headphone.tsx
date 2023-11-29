import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHeadphone = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 12a7 7 0 0 1 14 0v1h-1a3 3 0 0 0-3 3v2a3 3 0 1 0 6 0v-6a9 9 0 0 0-8-8.945V3h-1a9 9 0 0 0-9 9v6a3 3 0 1 0 6 0v-2a3 3 0 0 0-3-3H5v-1Z"
    />
  </Svg>
);
export default SvgHeadphone;
