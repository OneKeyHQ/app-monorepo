import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgClockTimeHistory = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Zm1-14a1 1 0 1 0-2 0v4a1 1 0 0 0 .293.707l2.5 2.5a1 1 0 0 0 1.414-1.414L13 11.586V8Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgClockTimeHistory;
