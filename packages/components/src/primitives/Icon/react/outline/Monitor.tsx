import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMonitor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18 20c-1.886-.649-3.903-1-6-1s-4.114.351-6 1m-1-4h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgMonitor;
