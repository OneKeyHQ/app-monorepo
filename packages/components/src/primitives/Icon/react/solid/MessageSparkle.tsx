import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageSparkle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.002 3h12a3 3 0 0 1 3 3v10.036a3 3 0 0 1-3 3h-2.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-2.65a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM12 7a.57.57 0 0 1 .571.571c0 1.121.249 1.798.655 2.204.405.405 1.082.654 2.203.654a.571.571 0 1 1 0 1.142c-1.121 0-1.798.249-2.204.655-.405.405-.654 1.082-.654 2.203a.571.571 0 1 1-1.142 0c0-1.121-.249-1.798-.655-2.204-.405-.405-1.082-.654-2.203-.654a.571.571 0 1 1 0-1.142c1.121 0 1.798-.249 2.204-.654.405-.406.654-1.083.654-2.204A.57.57 0 0 1 12 7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageSparkle;
