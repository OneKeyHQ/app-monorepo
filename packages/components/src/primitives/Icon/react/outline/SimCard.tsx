import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSimCard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 13.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 15.5v-2Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 5a2 2 0 0 1 2-2h5.343a4 4 0 0 1 2.829 1.172l2.656 2.656A4 4 0 0 1 19 9.657V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5Z"
    />
  </Svg>
);
export default SvgSimCard;
