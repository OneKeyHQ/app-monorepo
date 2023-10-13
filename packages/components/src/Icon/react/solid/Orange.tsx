import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOrange = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18.413.664c-1.38-.228-2.754-.263-4.148.542a5.453 5.453 0 0 0-2.017 2.024c-.673-.909-1.722-1.645-2.971-2.005a1 1 0 0 0-.554 1.922 3.73 3.73 0 0 1 1.681.994A9.002 9.002 0 0 0 3 13a9 9 0 1 0 13.672-7.694 5.462 5.462 0 0 0 2.549-3.417 1 1 0 0 0-.808-1.225Zm-1.626 1.86a3.46 3.46 0 0 1-1.145 1.067 3.459 3.459 0 0 1-1.554.462c.29-.445.685-.83 1.177-1.115.477-.275.959-.4 1.522-.414Zm1.861 11.649a1 1 0 1 0-1.97-.346 4.755 4.755 0 0 1-3.85 3.851 1 1 0 1 0 .345 1.97 6.755 6.755 0 0 0 5.475-5.475Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOrange;
