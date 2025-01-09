import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCart = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 3a1 1 0 0 0 0 2h1.306a1 1 0 0 1 .986.836l1.443 8.657A3 3 0 0 0 8.695 17h8.11a3 3 0 0 0 2.96-2.507l1.027-6.164A2 2 0 0 0 18.82 6H6.348l-.082-.493A3 3 0 0 0 3.305 3H2Zm6.25 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
    />
  </Svg>
);
export default SvgCart;
