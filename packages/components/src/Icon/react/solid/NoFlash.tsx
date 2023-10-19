import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNoFlash = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M14.002 2.401c0-1.484-1.925-2.066-2.748-.832L7.725 6.862l-4.06-3.61a1 1 0 1 0-1.33 1.495l18 16a1 1 0 0 0 1.33-1.494l-4.268-3.793 3.419-5.128C21.48 9.335 20.766 8 19.568 8h-5.566V2.401ZM3.188 13.668l2.297-3.446 9.672 8.598-2.407 3.61c-.823 1.236-2.748.653-2.748-.831V16H4.436c-1.198 0-1.913-1.335-1.248-2.332Z"
    />
  </Svg>
);
export default SvgNoFlash;
