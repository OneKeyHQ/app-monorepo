import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWalletCard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1M3 8h18M3 8v3m18-3v3m0 0v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6m18 0h-6a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2H3"
    />
  </Svg>
);
export default SvgWalletCard;
