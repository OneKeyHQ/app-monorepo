import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWalletCard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm3-1a1 1 0 0 0-1 1h16a1 1 0 0 0-1-1H5Zm15 3H4v1h5a1 1 0 0 1 1 1 1 1 0 0 0 1 1h2a1 1 0 0 0 1-1 1 1 0 0 1 1-1h5V9Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWalletCard;
