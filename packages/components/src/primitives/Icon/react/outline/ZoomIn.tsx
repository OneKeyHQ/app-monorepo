import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgZoomIn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="m20 20-3.95-3.95M11 8v6m3-3H8m10 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
    />
  </Svg>
);
export default SvgZoomIn;
