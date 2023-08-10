import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBarsShrink = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM5 12a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H5.75A.75.75 0 0 1 5 12Zm2 5.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75Z"
    />
  </Svg>
);
export default SvgBarsShrink;
