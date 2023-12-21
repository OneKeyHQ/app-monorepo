import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSplit = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 9V4m0 0h5M4 4l8 8m3-8h5m0 0v5m0-5-8 8m0 0v8"
    />
  </Svg>
);
export default SvgSplit;
