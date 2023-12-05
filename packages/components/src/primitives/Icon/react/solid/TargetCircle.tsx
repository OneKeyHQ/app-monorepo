import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTargetCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 4a1 1 0 0 1 1 1v2.5a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1Zm2.5 5a1 1 0 1 0 0 2H17a1 1 0 1 0 0-2h-2.5ZM12 13.5a1 1 0 0 1 1 1V17a1 1 0 1 1-2 0v-2.5a1 1 0 0 1 1-1ZM7 11a1 1 0 1 0 0 2h2.5a1 1 0 1 0 0-2H7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTargetCircle;
