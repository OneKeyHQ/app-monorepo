import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11.529 2.295a.524.524 0 0 1 .942 0l2.475 5.151a.522.522 0 0 0 .403.291l5.697.746c.435.057.61.59.29.89l-4.167 3.93a.516.516 0 0 0-.154.47l1.047 5.613a.521.521 0 0 1-.763.55l-5.05-2.723a.525.525 0 0 0-.498 0l-5.05 2.723a.521.521 0 0 1-.763-.55l1.047-5.612a.516.516 0 0 0-.154-.471l-4.168-3.93a.518.518 0 0 1 .291-.89l5.697-.746a.522.522 0 0 0 .403-.29l2.475-5.152Z"
    />
  </Svg>
);
export default SvgStar;
