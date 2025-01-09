import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShieldCheckDone = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9.5 11.75 1.5 1.5 3.5-3.5m5.5 2.162V7.177a2 2 0 0 0-1.35-1.891l-6-2.062a2 2 0 0 0-1.3 0l-6 2.062A2 2 0 0 0 4 7.177v4.735c0 4.973 4 7.088 8 9.246 4-2.158 8-4.273 8-9.246Z"
    />
  </Svg>
);
export default SvgShieldCheckDone;
