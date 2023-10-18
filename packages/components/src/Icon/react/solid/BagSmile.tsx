import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBagSmile = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3.885 5.813A3 3 0 0 1 6.879 3h10.242a3 3 0 0 1 2.994 2.813l.75 12A3 3 0 0 1 17.871 21H6.13a3 3 0 0 1-2.994-3.187l.75-12ZM10 8a1 1 0 1 0-2 0 4 4 0 0 0 8 0 1 1 0 1 0-2 0 2 2 0 1 1-4 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBagSmile;
