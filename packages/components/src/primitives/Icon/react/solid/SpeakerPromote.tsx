import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSpeakerPromote = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M15.088 2.877a3 3 0 0 1 3.91 2.858v1.391a4.002 4.002 0 0 1 0 7.748v1.39a3 3 0 0 1-3.91 2.86l-1.45-.462A4 4 0 0 1 5.997 17v-.779l-1.912-.61a3 3 0 0 1-2.088-2.858V9.247a3 3 0 0 1 2.088-2.858l2.488-.794a.993.993 0 0 1 .145-.055l8.37-2.663Zm-7.09 13.99V17a2 2 0 0 0 3.705 1.046l-3.705-1.18Zm12-5.867a2 2 0 0 1-1 1.732V9.268a2 2 0 0 1 1 1.732ZM6 7.878v6.244l-1.306-.416a1 1 0 0 1-.696-.953V9.247a1 1 0 0 1 .696-.953L6 7.878Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSpeakerPromote;
