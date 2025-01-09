import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDrink = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M17.476 1.783a1 1 0 0 1-.759 1.193L13 3.802V6h3.931a2 2 0 0 1 1.996 2.133L18.122 20.2A3 3 0 0 1 15.13 23H8.87a3 3 0 0 1-2.993-2.8l-.542-8.133v-.005l-.263-3.929A2 2 0 0 1 7.07 6H11V3a1 1 0 0 1 .783-.976l4.5-1a1 1 0 0 1 1.193.76ZM7.27 11h9.462l.2-3H7.07l.2 3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDrink;
