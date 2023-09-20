import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEye = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <Path
      fillRule="evenodd"
      d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113zM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEye;
