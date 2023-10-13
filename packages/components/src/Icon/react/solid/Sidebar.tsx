import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSidebar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H5ZM4 7a1 1 0 0 1 1-1h5v12H5a1 1 0 0 1-1-1V7Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 10a1.25 1.25 0 1 1 0-2.5A1.25 1.25 0 0 1 7 10Zm0 3.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm0 3.25A1.25 1.25 0 1 1 7 14a1.25 1.25 0 0 1 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSidebar;
