import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgNavSettings = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M20.402 13.58c.358.19.634.49.828.79.378.62.348 1.38-.02 2.05l-.716 1.2a2.13 2.13 0 0 1-1.809 1.04c-.357 0-.756-.1-1.083-.3-.266-.17-.572-.23-.9-.23-1.011 0-1.86.83-1.89 1.82 0 1.15-.94 2.05-2.115 2.05h-1.39c-1.186 0-2.126-.9-2.126-2.05-.02-.99-.868-1.82-1.88-1.82-.337 0-.644.06-.9.23-.327.2-.735.3-1.083.3-.736 0-1.44-.4-1.819-1.04l-.705-1.2c-.378-.65-.399-1.43-.02-2.05.163-.3.47-.6.817-.79.286-.14.47-.37.644-.64.51-.86.204-1.99-.664-2.5a2.044 2.044 0 0 1-.757-2.83L3.5 6.43a2.124 2.124 0 0 1 2.882-.76c.89.48 2.044.16 2.565-.69.164-.28.256-.58.235-.88-.02-.39.092-.76.286-1.06A2.194 2.194 0 0 1 11.277 2h1.44c.756 0 1.441.42 1.82 1.04.183.3.306.67.275 1.06-.02.3.072.6.235.88.521.85 1.676 1.17 2.575.69a2.112 2.112 0 0 1 2.872.76l.685 1.18c.593.99.266 2.26-.756 2.83-.869.51-1.176 1.64-.654 2.5.163.27.347.5.633.64ZM9.11 12.01c0 1.57 1.298 2.82 2.902 2.82s2.872-1.25 2.872-2.82c0-1.57-1.268-2.83-2.872-2.83-1.604 0-2.902 1.26-2.902 2.83Z"
    />
  </Svg>
);

export default SvgNavSettings;
