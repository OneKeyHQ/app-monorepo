import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendar3Add = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm5 8a1 1 0 1 0-2 0v1.5H9.5a1 1 0 1 0 0 2H11V15a1 1 0 0 0 2 0v-1.5h1.5a1 1 0 1 0 0-2H13V10Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Add;
