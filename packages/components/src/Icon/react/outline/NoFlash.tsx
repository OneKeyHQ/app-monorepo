import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNoFlash = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="m7.725 6.862-4.06-3.61a1 1 0 1 0-1.33 1.495l18 16a1 1 0 0 0 1.33-1.494l-4.268-3.793 3.419-5.128C21.48 9.335 20.766 8 19.568 8h-5.566V2.401c0-1.484-1.925-2.066-2.748-.832L7.725 6.862Zm1.51 1.342 6.653 5.914L18.633 10h-5.131a1.5 1.5 0 0 1-1.5-1.5V4.053l-2.767 4.15Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="m5.485 10.222 1.51 1.342L5.37 14h5.132a1.5 1.5 0 0 1 1.5 1.5v4.447l1.646-2.469 1.51 1.342-2.408 3.61c-.823 1.236-2.748.653-2.748-.831V16H4.436c-1.198 0-1.913-1.335-1.248-2.332l2.297-3.446Z"
    />
  </Svg>
);
export default SvgNoFlash;
