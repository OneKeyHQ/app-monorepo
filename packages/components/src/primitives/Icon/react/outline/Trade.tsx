import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTrade = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8v8M9.5 4v8m5 0v8M20 8v8"
    />
  </Svg>
);
export default SvgTrade;
