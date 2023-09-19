import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCheck = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m4.5 12.75 6 6 9-13.5"
    />
  </Svg>
);
export default SvgCheck;
