import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBatteryEmpty = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8Zm17 1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2V9Z"
    />
  </Svg>
);
export default SvgBatteryEmpty;
