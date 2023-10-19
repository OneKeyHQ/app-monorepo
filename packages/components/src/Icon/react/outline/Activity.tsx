import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgActivity = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2 12h2.501a2 2 0 0 0 1.92-1.438l2.1-7.173a.5.5 0 0 1 .959 0l5.04 17.221c.14.48.82.48.96 0l2.1-7.172A2 2 0 0 1 19.498 12H22"
    />
  </Svg>
);
export default SvgActivity;
