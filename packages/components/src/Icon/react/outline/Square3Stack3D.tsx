import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSquare3Stack3D = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="m4 17 8 4 8-4M4 12l8 4 8-4m-8-9L4 7l8 4 8-4-8-4Z"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgSquare3Stack3D;
