import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChecklistBoxSearch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h6.528A6 6 0 0 1 21 12.528V6a3 3 0 0 0-3-3H6Zm4.14 3.952a1 1 0 0 1 .2 1.4l-1.872 2.496a1 1 0 0 1-1.355.232l-1.125-.75a1 1 0 1 1 1.11-1.664l.338.225L8.74 7.152a1 1 0 0 1 1.4-.2ZM13.058 9a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1Zm-2.918 3.953a1 1 0 0 1 .2 1.4L8.468 16.85a1 1 0 0 1-1.355.232l-1.125-.75a1 1 0 1 1 1.11-1.664l.338.225 1.304-1.739a1 1 0 0 1 1.4-.2Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18.414 15.586a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828Zm-4.242-1.415a4 4 0 0 1 6.274 4.861l1.261 1.26a1 1 0 0 1-1.414 1.415l-1.26-1.26a4.002 4.002 0 0 1-4.861-6.275Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChecklistBoxSearch;
