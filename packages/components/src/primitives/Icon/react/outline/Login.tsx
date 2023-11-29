import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLogin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3m-.5-8H4m10.5 0L11 15.5m3.5-3.5L11 8.5"
    />
  </Svg>
);
export default SvgLogin;
