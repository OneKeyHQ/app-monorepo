import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWatchSquare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.823 2.368A2 2 0 0 1 8.721 1h6.558a2 2 0 0 1 1.898 1.368l.576 1.727A3.001 3.001 0 0 1 20 7v10a3.001 3.001 0 0 1-2.247 2.905l-.576 1.727A2 2 0 0 1 15.279 23H8.721a2 2 0 0 1-1.898-1.367l-.575-1.728A3.001 3.001 0 0 1 4 17V7c0-1.397.955-2.571 2.248-2.905l.575-1.727ZM8.387 20l.334 1h6.558l.334-1H8.387ZM15.28 3l.334 1H8.387l.334-1h6.558ZM13 9a1 1 0 1 0-2 0v3a1 1 0 0 0 .293.707l1.5 1.5a1 1 0 0 0 1.414-1.414L13 11.586V9Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWatchSquare;
