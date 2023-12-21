import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDivider = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12h18M3 5h2m6 0h2m6 0h2M3 19h2m6 0h2m6 0h2"
    />
  </Svg>
);
export default SvgDivider;
