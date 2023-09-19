import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgServer = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.08 5.227A3 3 0 0 1 6.979 3H17.02a3 3 0 0 1 2.9 2.227l2.113 7.926A5.228 5.228 0 0 0 18.75 12H5.25a5.228 5.228 0 0 0-3.284 1.153L4.08 5.227z" />
    <Path
      fillRule="evenodd"
      d="M5.25 13.5a3.75 3.75 0 1 0 0 7.5h13.5a3.75 3.75 0 1 0 0-7.5H5.25zm10.5 4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm3.75-.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgServer;
