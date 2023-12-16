import {
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';

interface IStepProps {
  state: 'pending' | 'inProgress' | 'done' | 'error';
  title: string;
}

const steps: IStepProps[] = [
  {
    state: 'inProgress',
    title: 'Verifying official firmware on your hardware wallet',
  },
  {
    state: 'pending',
    title: 'Creating your wallet',
  },
  {
    state: 'pending',
    title: 'Generating your accounts',
  },
  {
    state: 'pending',
    title: 'Encrypting your data',
  },
  {
    state: 'pending',
    title: 'Your wallet is now ready',
  },
];

export function FinalizeWalletSetup() {
  return (
    <Page>
      <Page.Header title="Finalize Wallet Setup" />
      <Page.Body p="$5">
        {steps.map(({ state, title }, index) => (
          <XStack
            key={title}
            {...(index !== 0 && {
              mt: '$5',
            })}
          >
            <Stack h="$6" w="$6" justifyContent="center" alignItems="center">
              {state === 'pending' && (
                <Icon
                  name="CirclePlaceholderOnOutline"
                  color="$iconSubdued"
                  flexShrink={0}
                />
              )}
              {state === 'inProgress' && <Spinner size="small" />}
            </Stack>
            <SizableText pl="$4" size="$bodyLgMedium">
              {title}
            </SizableText>
          </XStack>
        ))}

        {/* 
          1. 防伪校验
          2. 正在创建钱包
          3. 正在生成账户
          4. 正在加密数据
          5. 完成
        */}
      </Page.Body>
    </Page>
  );
}
