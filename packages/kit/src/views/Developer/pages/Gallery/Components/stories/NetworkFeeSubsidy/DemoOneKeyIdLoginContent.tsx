import { useEffect, useRef, useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

const DEMO_CODE = '123456';

// Keep this flow independent of production authentication and email services.
export function DemoOneKeyIdLoginContent({
  onComplete,
}: {
  onComplete: () => Promise<void>;
}) {
  const [step, setStep] = useState<'methods' | 'code'>('methods');
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const completing = useRef(false);
  const validEmail = stringUtils.isValidEmail(email.trim());

  useEffect(() => {
    if (step !== 'code' || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, step]);

  const complete = async () => {
    if (completing.current) return;
    completing.current = true;
    setBusy(true);
    await onComplete();
  };

  const enterCode = () => {
    if (!validEmail || busy) return;
    setEmail(email.trim());
    setCode('');
    setError(false);
    setCountdown(60);
    setStep('code');
  };

  const verifyCode = async () => {
    if (code.length !== 6 || busy) return;
    if (code !== DEMO_CODE) {
      setError(true);
      return;
    }
    await complete();
  };

  return (
    <Stack testID="subsidy-demo-login">
      <Dialog.Header>
        <Dialog.Icon icon={step === 'code' ? 'BarcodeSolid' : 'OnekeyBrand'} />
        <Dialog.Title>
          {step === 'code' ? '输入验证码' : '登录 OneKey ID'}
        </Dialog.Title>
        <Dialog.Description color="$textSubdued">
          {step === 'code'
            ? email
            : '使用 OneKey ID 继续，查看并使用可用补贴。'}
        </Dialog.Description>
      </Dialog.Header>
      {step === 'methods' ? (
        <YStack gap="$3">
          <Button
            size="large"
            icon="GoogleIllus"
            disabled={busy}
            onPress={complete}
          >
            使用 Google 继续
          </Button>
          <Button
            size="large"
            icon="AppleBrand"
            disabled={busy}
            onPress={complete}
          >
            使用 Apple 继续
          </Button>
          <Button
            variant="tertiary"
            alignSelf="center"
            iconAfter={
              showEmail ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
            }
            disabled={busy}
            onPress={() => setShowEmail((value) => !value)}
          >
            更多登录方式
          </Button>
          {showEmail ? (
            <YStack gap="$3" pt="$3">
              <YStack gap="$2">
                <SizableText size="$bodyMdMedium">邮箱</SizableText>
                <Input
                  testID="subsidy-demo-login-email"
                  accessibilityLabel="邮箱"
                  size="large"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="name@example.com"
                  value={email}
                  disabled={busy}
                  onChangeText={setEmail}
                  onSubmitEditing={enterCode}
                />
              </YStack>
              <Button
                size="large"
                variant="primary"
                disabled={!validEmail || busy}
                onPress={enterCode}
              >
                登录或注册
              </Button>
            </YStack>
          ) : null}
          <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
            仅供演示，不连接真实账号或发送邮件。
          </SizableText>
        </YStack>
      ) : (
        <YStack gap="$3">
          <YStack bg="$bgSubdued" p="$3" borderRadius="$3" gap="$1">
            <SizableText size="$bodyMdMedium">
              演示验证码：{DEMO_CODE}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              无需查看邮箱，输入以上验证码即可继续。
            </SizableText>
          </YStack>
          <XStack>
            <Button
              size="small"
              variant="tertiary"
              disabled={countdown > 0 || busy}
              onPress={() => {
                setCountdown(60);
                setCode('');
                setError(false);
              }}
            >
              {countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送'}
            </Button>
          </XStack>
          <Input
            testID="subsidy-demo-login-code"
            accessibilityLabel="验证码"
            size="large"
            placeholder="输入验证码"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            error={error}
            disabled={busy}
            onChangeText={(value) => {
              setCode(value.replace(/[^0-9]/g, '').slice(0, 6));
              setError(false);
            }}
            onSubmitEditing={verifyCode}
          />
          {error ? (
            <SizableText size="$bodySm" color="$textCritical">
              验证码不正确，请输入演示验证码 {DEMO_CODE}。
            </SizableText>
          ) : null}
        </YStack>
      )}
      <Dialog.Footer
        showFooter={step === 'code'}
        showCancelButton={false}
        onConfirmText="下一步"
        confirmButtonProps={{
          disabled: code.length !== 6 || busy,
          loading: busy,
        }}
        onConfirm={async ({ preventClose }) => {
          preventClose();
          await verifyCode();
        }}
        extraContent={
          step === 'code' ? (
            <XStack justifyContent="center" px="$5" pb="$5">
              <Button
                variant="tertiary"
                disabled={busy}
                onPress={() => setStep('methods')}
              >
                选择其他登录方式
              </Button>
            </XStack>
          ) : undefined
        }
      />
    </Stack>
  );
}
