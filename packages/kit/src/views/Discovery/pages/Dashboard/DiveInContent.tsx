import { useIntl } from 'react-intl';
import { Path, Svg } from 'react-native-svg';

import { Button, SizableText, Stack, useTheme } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IDiveInContentProps {
  onReload: () => void;
}

export const DiveInContent = ({ onReload }: IDiveInContentProps) => {
  const intl = useIntl();
  const theme = useTheme();
  const defaultColor = theme.neutral6.val;

  return (
    <Stack
      px="$5"
      width="100%"
      $gtMd={{ width: 380 }}
      py="$8"
      gap="$4"
      alignItems="center"
      justifyContent="center"
    >
      <Svg
        width="36"
        height="63"
        viewBox="0 0 36 63"
        fill="none"
        color={defaultColor}
      >
        <Path
          d="M25.2358 38.6057C25.2903 37.3638 25.5357 35.8782 25.3866 34.4922C25.0556 31.5888 24.5931 28.7186 24.1306 25.8483C23.2248 20.4101 22.2797 14.9259 21.2826 9.00819C19.1077 12.6271 19.055 17.1346 14.9488 19.6212C14.7989 18.7937 14.4972 18.2556 14.6489 17.9662C16.983 13.4139 18.2262 8.52254 19.0883 3.55978C19.8373 -0.50912 21.554 -1.02564 24.4361 1.68125C27.4364 4.52585 30.7592 7.09374 33.8977 9.81974C34.423 10.2456 34.7112 10.9545 35.2164 11.6367C32.4475 12.4185 32.4475 12.4185 24.9212 7.00224C25.0645 7.91521 25.1357 8.65094 25.2531 9.34715C26.5903 16.4073 27.9736 23.428 29.1793 30.5213C29.5572 32.8267 29.672 35.1984 29.4911 37.5051C29.1694 41.6058 26.6484 43.6091 22.5666 43.0471C20.4829 42.7628 18.4395 41.966 16.4882 41.0901C14.2872 40.1097 12.2446 38.7543 10.0964 37.6489C8.56568 36.8903 6.93612 36.2962 5.27387 35.5708C4.31794 37.3471 4.67068 38.8772 4.85251 40.3945C5.63846 46.8121 7.35188 52.9121 9.84782 58.8986C10.136 59.6075 10.5558 60.2833 10.6664 61.065C10.7184 61.4985 10.4084 62.1628 10.0397 62.4791C9.85541 62.6372 9.05361 62.4485 8.77126 62.2127C8.05575 61.4719 7.35365 60.5602 6.90792 59.6676C3.66967 53.2821 1.62195 46.5127 0.889612 39.4116C0.701085 37.9797 0.775633 36.4815 1.01439 35.0814C1.47181 32.5375 3.03181 31.2789 5.57544 31.7263C7.6524 32.096 9.64978 32.9324 11.555 33.8478C14.3734 35.175 16.9942 36.8312 19.8126 38.1585C21.35 38.8316 23.019 39.4716 25.2358 38.6057Z"
          fill="currentColor"
        />
      </Svg>
      <SizableText size="$bodyLg" color="$neutral9" textAlign="center" mb="$2">
        {intl.formatMessage({
          id: ETranslations.browser_dive_in_description,
        })}
      </SizableText>
      <Button variant="secondary" size="medium" onPress={onReload}>
        {intl.formatMessage({
          id: ETranslations.explore_reload,
        })}
      </Button>
    </Stack>
  );
};

export default DiveInContent;
