import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgInbox = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3ZM6 5h12a1 1 0 0 1 1 1v6h-3.126a1 1 0 0 0-.969.75 3.002 3.002 0 0 1-5.81 0 1 1 0 0 0-.969-.75H5V6a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgInbox;
