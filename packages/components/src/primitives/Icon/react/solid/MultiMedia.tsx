import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMultiMedia = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-4H4a2 2 0 0 1-2-2zm12 4V4H4v6.132l1.445-.964a1 1 0 0 1 1.11 0L8 10.132V10a2 2 0 0 1 2-2zM5 6.25a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0m8.541 6.261a1 1 0 0 1 1.038.074l2.25 1.6a1 1 0 0 1 0 1.63l-2.25 1.6A1 1 0 0 1 13 16.6v-3.2a1 1 0 0 1 .541-.889"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMultiMedia;
