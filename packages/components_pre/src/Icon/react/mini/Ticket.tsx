import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTicket = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 3v1.27a.75.75 0 0 0 1.5 0V3h2.25A2.25 2.25 0 0 1 19 5.25v2.628a.75.75 0 0 1-.5.707 1.5 1.5 0 0 0 0 2.83c.3.106.5.39.5.707v2.628A2.25 2.25 0 0 1 16.75 17H14.5v-1.27a.75.75 0 0 0-1.5 0V17H3.25A2.25 2.25 0 0 1 1 14.75v-2.628c0-.318.2-.601.5-.707a1.5 1.5 0 0 0 0-2.83.75.75 0 0 1-.5-.707V5.25A2.25 2.25 0 0 1 3.25 3H13zm1.5 4.396a.75.75 0 0 0-1.5 0v1.042a.75.75 0 0 0 1.5 0V7.396zm0 4.167a.75.75 0 0 0-1.5 0v1.041a.75.75 0 0 0 1.5 0v-1.041zM6 10.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75zm0 2.5a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTicket;
