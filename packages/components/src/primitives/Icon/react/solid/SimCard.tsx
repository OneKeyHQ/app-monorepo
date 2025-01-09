import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSimCard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10 13.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-2Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 5a3 3 0 0 1 3-3h5.343a5 5 0 0 1 3.536 1.464l2.656 2.657A5 5 0 0 1 20 9.657V19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5Zm6.5 6A2.5 2.5 0 0 0 8 13.5v2a2.5 2.5 0 0 0 2.5 2.5h3a2.5 2.5 0 0 0 2.5-2.5v-2a2.5 2.5 0 0 0-2.5-2.5h-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSimCard;
