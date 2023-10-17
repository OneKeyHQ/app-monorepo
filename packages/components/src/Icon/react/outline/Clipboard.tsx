import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgClipboard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m6 0v2H9V5m6 0a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2"
    />
  </Svg>
);
export default SvgClipboard;
