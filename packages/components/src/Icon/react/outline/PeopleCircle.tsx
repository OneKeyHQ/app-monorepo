import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeopleCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6.116 18.81C7.446 17.094 9.5 16 12 16c2.5 0 4.554 1.094 5.884 2.81m-11.768 0A8.965 8.965 0 0 0 12 21c2.25 0 4.306-.825 5.884-2.19m-11.768 0a9 9 0 1 1 11.768 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </Svg>
);
export default SvgPeopleCircle;
