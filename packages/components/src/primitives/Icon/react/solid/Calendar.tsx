import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm-3 9v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7H5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar;
