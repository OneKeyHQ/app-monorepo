import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFilter2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M3 5h18M9 19h6m-9-7h12"
    />
  </Svg>
);
export default SvgFilter2;
