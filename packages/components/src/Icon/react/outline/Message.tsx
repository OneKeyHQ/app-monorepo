import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3.002 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10.036a2 2 0 0 1-2 2h-3.626a1 1 0 0 0-.638.23l-2.74 2.27-2.704-2.267a1 1 0 0 0-.642-.233h-3.65a2 2 0 0 1-2-2V6Z"
    />
  </Svg>
);
export default SvgMessage;
