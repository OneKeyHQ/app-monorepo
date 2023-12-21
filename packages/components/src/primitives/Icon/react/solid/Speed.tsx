import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSpeed = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M17.657 7.343a8 8 0 0 0-11.62 10.99 1 1 0 0 1-1.49 1.334C1.028 15.74 1.156 9.702 4.929 5.93c3.905-3.905 10.237-3.905 14.142 0 3.773 3.773 3.9 9.811.382 13.738a1 1 0 0 1-1.49-1.334 8 8 0 0 0-.306-10.99Zm-9.365 1.95a1 1 0 0 1 1.414 0l3 3a1 1 0 1 1-1.415 1.414l-3-3a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSpeed;
