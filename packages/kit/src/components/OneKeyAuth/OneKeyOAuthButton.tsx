import { Button } from '@onekeyhq/components/src/primitives/Button';

export function OneKeyOAuthButton({
  provider,
  label,
  testID,
  disabled,
  loading,
  onPress,
}: {
  provider: 'google' | 'apple';
  label: string;
  testID: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      size="large"
      icon={provider === 'google' ? 'GoogleIllus' : 'AppleBrand'}
      testID={testID}
      disabled={disabled}
      loading={loading}
      aria-busy={loading || undefined}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}
