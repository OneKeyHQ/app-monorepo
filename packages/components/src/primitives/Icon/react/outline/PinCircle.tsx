import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPinCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 12v5m1.768-9.268a2.5 2.5 0 1 1-3.536 3.536 2.5 2.5 0 0 1 3.536-3.536ZM12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z"
    />
  </Svg>
);
export default SvgPinCircle;
