import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCodeLines = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 5h10m5 0h3M3 12h5m5 0h8M3 19h7m5 0h6"
    />
  </Svg>
);
export default SvgCodeLines;
