import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDonut = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M11.832 5.915a2 2 0 0 1 2.708.553l.425.612a2 2 0 0 0 .984.749l.704.245a2 2 0 0 1 1.256 2.463l-.214.714a2 2 0 0 0 .029 1.236l.246.703a2 2 0 0 1-1.142 2.518l-.691.278a2 2 0 0 0-.949.792l-.396.632a2 2 0 0 1-2.68.677l-.649-.368a2 2 0 0 0-1.211-.247l-.74.084a2 2 0 0 1-2.201-1.674l-.117-.736a2 2 0 0 0-.562-1.101l-.527-.527a2 2 0 0 1-.064-2.764l.503-.55a2 2 0 0 0 .51-1.126l.084-.74a2 2 0 0 1 2.12-1.773l.744.05a2 2 0 0 0 1.199-.303l.63-.397Z"
    />
  </Svg>
);
export default SvgDonut;
