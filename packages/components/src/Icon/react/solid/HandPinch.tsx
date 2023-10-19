import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHandPinch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2.86 6.817a1 1 0 0 1 .573 1.294c-.577 1.492-.577 2.786 0 4.278a1 1 0 0 1-1.866.722c-.756-1.957-.756-3.765 0-5.722a1 1 0 0 1 1.294-.572Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="m11.387 8.217 4.88-2.921c1.617-.968 3.685-.394 4.618 1.283l1.031 1.851c2.232 4.008.907 9.133-2.958 11.447a7.836 7.836 0 0 1-8.352-.17l-5.571-3.643a1 1 0 0 1-.442-.982l.11-.756c.188-1.276 1.338-2.153 2.568-1.959l1.34.211-3.382-6.072c-.622-1.118-.253-2.547.825-3.192 1.078-.646 2.457-.263 3.08.855l2.253 4.048Z"
    />
  </Svg>
);
export default SvgHandPinch;
