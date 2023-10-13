import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChecklistBoxNotification = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h6v-4a6 6 0 0 1 9-5.197V6a3 3 0 0 0-3-3H6Zm4.14 3.952a1 1 0 0 1 .2 1.4l-1.872 2.496a1 1 0 0 1-1.355.232l-1.125-.75a1 1 0 1 1 1.11-1.664l.338.225L8.74 7.152a1 1 0 0 1 1.4-.2ZM13.058 9a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1Zm-2.918 3.953a1 1 0 0 1 .2 1.4L8.468 16.85a1 1 0 0 1-1.355.232l-1.125-.75a1 1 0 1 1 1.11-1.664l.338.225 1.304-1.739a1 1 0 0 1 1.4-.2Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14 17a4 4 0 0 1 8 0v3a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-3Zm4-2a2 2 0 0 0-2 2v2h4v-2a2 2 0 0 0-2-2Z"
      clipRule="evenodd"
    />
    <Path fill="currentColor" d="M18 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Z" />
  </Svg>
);
export default SvgChecklistBoxNotification;
