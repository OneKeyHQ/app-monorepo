import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgShoppingBag = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z"
    />
  </Svg>
);

export default SvgShoppingBag;
