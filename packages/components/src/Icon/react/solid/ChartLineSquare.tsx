import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChartLineSquare = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm10.875 7.452a.75.75 0 1 0-.75-1.299 12.81 12.81 0 0 0-3.558 3.05l-1.537-1.536a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l2.47-2.47 1.617 1.618a.75.75 0 0 0 1.146-.101 11.312 11.312 0 0 1 3.612-3.322Z"
    />
  </Svg>
);
export default SvgChartLineSquare;
