import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRowsWide = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M3 12V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 12h18"
    />
  </Svg>
);
export default SvgRowsWide;
