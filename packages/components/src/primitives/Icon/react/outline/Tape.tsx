import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTape = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8.5 14h7M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm5.914 5.586a2 2 0 1 1-2.828 2.828 2 2 0 0 1 2.828-2.828Zm7 0a2 2 0 1 1-2.828 2.828 2 2 0 0 1 2.828-2.828Z"
    />
  </Svg>
);
export default SvgTape;
