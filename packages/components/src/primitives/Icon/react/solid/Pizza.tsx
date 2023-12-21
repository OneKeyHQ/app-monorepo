import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPizza = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M14 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    <Path
      fill="currentColor"
      d="M11 6c0-.565.156-1.094.428-1.545l-4.259.73a13.986 13.986 0 0 0 4.996 8.675 4.002 4.002 0 0 1 7.305-.85l1.038-6.054c.35-2.04-1.424-3.814-3.464-3.464l-1.134.195A3 3 0 1 1 11 6Z"
    />
    <Path
      fill="currentColor"
      d="m17.317 16.51.092-.09A2 2 0 1 0 14 15v.127a13.915 13.915 0 0 0 3.317 1.384Z"
    />
    <Path
      fill="currentColor"
      d="M18.477 18.802c-6.816-1.08-12.2-6.463-13.28-13.28l-.368.064C3.216 5.863 2 7.458 2.528 9.176a18.531 18.531 0 0 0 4.626 7.67 18.531 18.531 0 0 0 7.67 4.627c1.718.528 3.313-.689 3.59-2.302l.063-.369Z"
    />
  </Svg>
);
export default SvgPizza;
