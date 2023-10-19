import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendar3Search = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10 12a1.75 1.75 0 1 1 3.5 0 1.75 1.75 0 0 1-3.5 0Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm3.75 6.25a3.75 3.75 0 1 0 1.849 7.013l.694.694a1 1 0 0 0 1.414-1.414l-.694-.694A3.75 3.75 0 0 0 11.75 8.25Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Search;
