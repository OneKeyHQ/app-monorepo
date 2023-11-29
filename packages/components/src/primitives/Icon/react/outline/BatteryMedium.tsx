import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBatteryMedium = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 10v4m4.5-4v4M4 18h13a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Zm15-9h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2V9Z"
    />
  </Svg>
);
export default SvgBatteryMedium;
