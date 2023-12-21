import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGrowth = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 12v-1a7 7 0 0 0-7-7H4v1a7 7 0 0 0 7 7h1Zm0 0v2m0 1h1a7 7 0 0 0 7-7V7h-1a7 7 0 0 0-7 7m0 1v-1m0 1v5"
    />
  </Svg>
);
export default SvgGrowth;
