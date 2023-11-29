import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLightBulb = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 9a8 8 0 1 1 14.245 5H5.755A7.967 7.967 0 0 1 4 9Zm4 7v1a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-1H8Zm1 5a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1Z"
    />
  </Svg>
);
export default SvgLightBulb;
