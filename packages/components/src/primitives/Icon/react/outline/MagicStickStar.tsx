import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagicStickStar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m11.773 12.227.99 4.102a.25.25 0 0 0 .457.072l2.13-3.464a.25.25 0 0 1 .232-.119l4.056.313a.25.25 0 0 0 .21-.411L17.21 9.623a.25.25 0 0 1-.04-.257l1.55-3.76a.25.25 0 0 0-.326-.327l-3.76 1.551a.25.25 0 0 1-.258-.04L11.28 4.152a.25.25 0 0 0-.412.21l.314 4.055a.25.25 0 0 1-.119.233l-3.465 2.13a.25.25 0 0 0 .072.456l4.103.991Zm0 0L4 20"
    />
  </Svg>
);
export default SvgMagicStickStar;
