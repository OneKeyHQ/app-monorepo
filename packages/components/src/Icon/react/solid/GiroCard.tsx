import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGiroCard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm7 3a1 1 0 0 0-1-1H7a1 1 0 0 0 0 2h1a1 1 0 0 0 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGiroCard;
