import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSign = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11 5a2 2 0 0 1 2-2h5a3 3 0 0 1 2.4 1.2l1.5 2a3 3 0 0 1 0 3.6l-1.5 2A3 3 0 0 1 18 13h-5v7a1 1 0 1 1-2 0v-3H6a3 3 0 0 1-2.4-1.2l-1.5-2a3 3 0 0 1 0-3.6l1.5-2A3 3 0 0 1 6 7h5V5Zm2 6h5a1 1 0 0 0 .8-.4l1.5-2a1 1 0 0 0 0-1.2l-1.5-2A1 1 0 0 0 18 5h-5v6Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSign;
