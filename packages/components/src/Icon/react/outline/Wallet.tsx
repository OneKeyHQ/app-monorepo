import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWallet = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6.5A3.5 3.5 0 0 1 6.5 3h8.75c.966 0 1.75.784 1.75 1.75V8h1a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-5a1 1 0 1 1 0-2h5a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H6.5c-.537 0-1.045-.12-1.5-.337v.837a1 1 0 1 1-2 0v-4Zm2 0A1.5 1.5 0 0 0 6.5 8H15V5H6.5A1.5 1.5 0 0 0 5 6.5Zm-.008 6.68a2 2 0 0 1 2.016 0l2 1.167A2 2 0 0 1 10 16.074v2.352a2 2 0 0 1-.992 1.727l-2 1.167a2 2 0 0 1-2.016 0l-2-1.167A2 2 0 0 1 2 18.426v-2.352a2 2 0 0 1 .992-1.727l2-1.167ZM8 16.074l-2-1.166-2 1.166v2.352l2 1.166 2-1.166v-2.352Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M17 14.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
    />
  </Svg>
);
export default SvgWallet;
