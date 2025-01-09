import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMountainBike = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      fillRule="evenodd"
      d="M13 5a1 1 0 0 1 1-1h.512a3 3 0 0 1 2.874 2.138l1.164 3.882a5 5 0 1 1-1.916.574l-.139-.463-6.688 3.489a5 5 0 1 1-.926-1.773l.812-.423L7.2 8.1a1.01 1.01 0 0 1-.066-.1H7a1 1 0 1 1 0-2h3a1 1 0 1 1 0 2h-.375l1.865 2.486 4.42-2.306-.44-1.467A1 1 0 0 0 14.512 6H14a1 1 0 0 1-1-1Zm-5.955 7.805a3 3 0 1 0 .925 1.773l-2.507 1.309a1 1 0 1 1-.925-1.774l2.507-1.308Zm10.997 2.482-.813-2.71a3 3 0 1 0 1.916-.574l.813 2.71a1 1 0 1 1-1.916.574Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMountainBike;
