import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPinLocation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 14.364c-2.963.573-5 1.762-5 3.136 0 1.933 4.03 3.5 9 3.5s9-1.567 9-3.5c0-1.374-2.037-2.563-5-3.136M12 9v8m2.121-13.121A3 3 0 1 1 9.88 8.12a3 3 0 0 1 4.242-4.242Z"
    />
  </Svg>
);
export default SvgPinLocation;
