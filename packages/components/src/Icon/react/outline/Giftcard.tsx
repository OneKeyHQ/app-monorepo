import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGiftcard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 5v7m0 0v7m0-7h7m-7 0H3m11 0 3-3m-3 3-3-3m3 3 3 3m-3-3-3 3m-6 4h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgGiftcard;
