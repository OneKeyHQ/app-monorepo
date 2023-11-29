import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgH2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 5v7m0 0v7m0-7H3m0-7v7m0 0v7m19 0h-4l3.495-4.432A2 2 0 0 0 22 13.24V13a2 2 0 0 0-3.732-1"
    />
  </Svg>
);
export default SvgH2;
