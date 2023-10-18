import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeopleShadow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 3a3.5 3.5 0 1 1 0 7m5.5 10h.5c1.105 0 2.03-.918 1.68-1.966-.688-2.06-2.43-3.728-4.68-4.525M9 10a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm-7.68 8.034C2.29 15.125 5.362 13 9 13s6.71 2.125 7.68 5.034C17.03 19.082 16.105 20 15 20H3c-1.105 0-2.03-.918-1.68-1.966Z"
    />
  </Svg>
);
export default SvgPeopleShadow;
