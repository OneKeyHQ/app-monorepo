import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerDownLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M19 5a1 1 0 1 1 2 0v6a5 5 0 0 1-5 5H5.914l2.293 2.293a1 1 0 1 1-1.414 1.414L3.5 16.414a2 2 0 0 1 0-2.828l3.293-3.293a1 1 0 1 1 1.414 1.414L5.914 14H16a3 3 0 0 0 3-3V5Z"
    />
  </Svg>
);
export default SvgCornerDownLeft;
