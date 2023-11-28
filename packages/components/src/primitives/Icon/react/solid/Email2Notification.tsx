import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEmail2Notification = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M20 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M20 12a5.999 5.999 0 0 1-1.76-.262A15.949 15.949 0 0 1 12 13c-3.784 0-7.26-1.313-10-3.51V17a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-5.341A5.99 5.99 0 0 1 20 12Z"
    />
    <Path
      fill="currentColor"
      d="M14 6c0-.701.12-1.374.341-2H5a3 3 0 0 0-2.994 2.804A13.958 13.958 0 0 0 12 11c1.374 0 2.702-.198 3.957-.567A5.985 5.985 0 0 1 14 6Z"
    />
  </Svg>
);
export default SvgEmail2Notification;
