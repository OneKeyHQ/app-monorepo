import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgH3 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 5v7m0 0v7m0-7H3m0-7v7m0 0v7m15.268-7A2 2 0 0 1 22 13a2 2 0 0 1-2 2 2 2 0 1 1-1.732 3"
    />
  </Svg>
);
export default SvgH3;
