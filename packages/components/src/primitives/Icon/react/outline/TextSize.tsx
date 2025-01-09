import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTextSize = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6.927 20v-9.001M22 5H10m2 6H2m14-6v15"
    />
  </Svg>
);
export default SvgTextSize;
