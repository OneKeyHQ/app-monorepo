import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMacinthosh = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18.25V20a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.75M14 15h2M8 6h8v6H8V6ZM5 16V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"
    />
  </Svg>
);
export default SvgMacinthosh;
