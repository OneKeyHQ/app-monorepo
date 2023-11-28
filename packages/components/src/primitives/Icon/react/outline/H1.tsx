import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgH1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 5v7m0 7v-7m10-7v7m0 7v-7m0 0H3m15 1.5 3-2.5v8"
    />
  </Svg>
);
export default SvgH1;
