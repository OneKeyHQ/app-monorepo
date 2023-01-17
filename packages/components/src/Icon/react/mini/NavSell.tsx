import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNavSell = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.695 9.848a1.92 1.92 0 0 1 .472-.222v1.415a1.92 1.92 0 0 1-.472-.222c-.304-.203-.361-.39-.361-.486 0-.095.057-.282.36-.485ZM12.834 14.374V12.96c.183.06.343.137.472.223.303.202.36.39.36.485 0 .095-.057.283-.36.485a1.92 1.92 0 0 1-.472.222Z" />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M22 7.33C22 3.92 20.06 2 16.66 2H7.33C3.92 2 2 3.92 2 7.33v9.34C2 20.06 3.92 22 7.33 22h9.34c3.4 0 5.33-1.94 5.33-5.33V7.33Zm-9.166.503a.833.833 0 1 0-1.667 0v.077a3.779 3.779 0 0 0-1.397.552c-.601.4-1.103 1.046-1.103 1.871 0 .826.502 1.471 1.103 1.872.4.267.879.454 1.397.552v1.617c-.326-.105-.567-.264-.703-.42a.833.833 0 1 0-1.259 1.092c.469.54 1.178.897 1.962 1.044v.077a.833.833 0 1 0 1.667 0v-.077a3.781 3.781 0 0 0 1.396-.551c.602-.401 1.104-1.047 1.104-1.872 0-.826-.502-1.471-1.104-1.872a3.78 3.78 0 0 0-1.396-.552V9.626c.325.106.567.264.702.42a.833.833 0 1 0 1.26-1.092c-.47-.54-1.179-.896-1.962-1.044v-.077Z"
    />
  </Svg>
);
export default SvgNavSell;
