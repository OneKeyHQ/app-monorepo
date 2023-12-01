import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLink = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12.379 3.207a3 3 0 0 1 4.242 0l4.172 4.172a3 3 0 0 1 0 4.242l-2.086 2.086a1 1 0 0 1-1.414-1.414l2.086-2.086a1 1 0 0 0 0-1.414l-4.172-4.171a1 1 0 0 0-1.414 0l-2.086 2.085a1 1 0 1 1-1.414-1.414l2.086-2.086Zm3.328 5.086a1 1 0 0 1 0 1.414l-6 6a1 1 0 0 1-1.414-1.414l6-6a1 1 0 0 1 1.414 0Zm-9 2a1 1 0 0 1 0 1.414l-2.086 2.086a1 1 0 0 0 0 1.414l-.703.704.703-.704 4.172 4.172a1 1 0 0 0 1.414 0l2.086-2.086a1 1 0 0 1 1.414 1.414l-2.086 2.086a3 3 0 0 1-4.242 0l-4.172-4.171a3 3 0 0 1 0-4.243l2.086-2.086a1 1 0 0 1 1.414 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLink;
