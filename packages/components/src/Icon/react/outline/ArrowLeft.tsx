import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9.21 18.04-4.585-4.586a2 2 0 0 1 0-2.829l4.586-4.586m-4.25 6h15"
    />
  </Svg>
);
export default SvgArrowLeft;
