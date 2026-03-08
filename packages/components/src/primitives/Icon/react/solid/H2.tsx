import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgH2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 11h8V4h2v16h-2v-7H4v7H2V4h2zm16-1a3 3 0 0 1 3 3v.24a3 3 0 0 1-.758 1.992L19.782 18H23v2h-6v-1.88l3.747-4.216a1 1 0 0 0 .253-.665V13a1 1 0 0 0-1.857-.516 1.6 1.6 0 0 0-.119.457 3 3 0 0 0-.024.29v.01s0-.002-1-.002h-1v-.02l.001-.036a5 5 0 0 1 .042-.51c.04-.29.125-.739.343-1.145l.008-.014.008-.015A3 3 0 0 1 20 10" />
  </Svg>
);
export default SvgH2;
