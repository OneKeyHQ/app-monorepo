import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBatteryLoading = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5m12-12h.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3M12 6l-4.5 6h6L9 18m10-9h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2V9Z"
    />
  </Svg>
);
export default SvgBatteryLoading;
