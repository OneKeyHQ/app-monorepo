import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageNotification = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M21.002 13.018v3.018a2 2 0 0 1-2 2h-3.626a1 1 0 0 0-.638.23l-2.74 2.27-2.704-2.267a1 1 0 0 0-.642-.233h-3.65a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7M22 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </Svg>
);
export default SvgMessageNotification;
