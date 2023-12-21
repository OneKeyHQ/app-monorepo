import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageSparkle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.002 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10.036a2 2 0 0 1-2 2h-2.626a1 1 0 0 0-.638.23l-2.74 2.27-2.704-2.267a1 1 0 0 0-.642-.233h-2.65a2 2 0 0 1-2-2V6Z"
    />
    <Path
      fill="currentColor"
      d="M12.571 7.571a.571.571 0 1 0-1.142 0c0 1.121-.249 1.798-.655 2.204-.405.405-1.082.654-2.203.654a.571.571 0 1 0 0 1.142c1.121 0 1.798.249 2.204.655.405.405.654 1.082.654 2.203a.571.571 0 1 0 1.142 0c0-1.121.249-1.798.655-2.204.405-.405 1.082-.654 2.203-.654a.571.571 0 1 0 0-1.142c-1.121 0-1.798-.249-2.204-.654-.405-.406-.654-1.083-.654-2.204Z"
    />
  </Svg>
);
export default SvgMessageSparkle;
