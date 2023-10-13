import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOption2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 19h2.84a2 2 0 0 0 1.736-1.008l6.848-11.984A2 2 0 0 1 17.161 5H20m0 14h-4"
    />
  </Svg>
);
export default SvgOption2;
