import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14.498 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 10c0 4.37-3.886 8.335-5.867 10.072a1.702 1.702 0 0 1-2.266 0C8.886 18.335 5 14.37 5 10a7 7 0 0 1 14 0Z"
    />
  </Svg>
);
export default SvgPin;
