import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendar3Remove = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm2.455 7.543a1 1 0 0 0-1.414 1.414l1.545 1.545-1.543 1.543a1 1 0 1 0 1.414 1.414L12 13.916l1.543 1.543a1 1 0 0 0 1.414-1.414l-1.543-1.543 1.545-1.545a1 1 0 0 0-1.414-1.414L12 11.088l-1.545-1.545Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Remove;
