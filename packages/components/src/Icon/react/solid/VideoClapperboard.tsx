import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVideoClapperboard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm2 0a1 1 0 0 1 1-1h1.78l-.6 3H4V7Zm16 2V7a1 1 0 0 0-1-1h-1.18l-.6 3H20Zm-4.82 0 .6-3h-2.46l-.6 3h2.46Zm-4.5 0 .6-3H8.82l-.6 3h2.46Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoClapperboard;
