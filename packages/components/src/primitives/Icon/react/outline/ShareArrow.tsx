import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShareArrow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m21.925 11.456-7.66-7.257A.75.75 0 0 0 13 4.744V8a.51.51 0 0 1-.504.504C4.541 8.62 2.085 11.566 2.002 19.573c0 .105.141.142.19.048 1.378-2.69 2.62-4.062 10.303-4.12A.501.501 0 0 1 13 16v3.256a.75.75 0 0 0 1.266.545l7.66-7.256a.75.75 0 0 0 0-1.09Z"
    />
  </Svg>
);
export default SvgShareArrow;
