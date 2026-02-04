import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWalletCrypto = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.616 12.747a1 1 0 0 1 .888.06l3 1.75a1 1 0 0 1 .496.864v3.5a1 1 0 0 1-.496.864l-3 1.75a1 1 0 0 1-1.008 0l-3-1.75A1 1 0 0 1 2 18.921v-3.5a1 1 0 0 1 .496-.864l3-1.75zM4 15.995v2.35l2 1.168 2-1.167v-2.35l-2-1.167z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M15.25 2.921c.966 0 1.75.783 1.75 1.75v3.25h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6a1 1 0 0 1 0-2h6v-9H6.5A3.5 3.5 0 0 1 5 9.584v.837a1 1 0 0 1-2 0v-4a3.5 3.5 0 0 1 3.5-3.5zm-8.75 2a1.5 1.5 0 1 0 0 3H15v-3z"
      clipRule="evenodd"
    />
    <Path d="M15.5 13.171a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
  </Svg>
);
export default SvgWalletCrypto;
