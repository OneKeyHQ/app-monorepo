import type { PropsWithChildren, ReactElement } from 'react';
import { Children, createContext, useContext, useMemo } from 'react';

import { withStaticProperties } from 'tamagui';

import { Badge } from '../../content';
import {
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '../../primitives';

export enum EStepItemStatus {
  Done = 'done',
  Failed = 'failed',
  Pending = 'pending',
  Inactive = 'inactive',
}

export function StepItemStatus({ status }: { status: EStepItemStatus }) {
  if (status === EStepItemStatus.Inactive) {
    return (
      <Stack
        borderRadius="$full"
        w="$5"
        h="$5"
        borderColor="$iconDisabled"
        borderWidth="$0.5"
      />
    );
  }
  if (status === EStepItemStatus.Pending) {
    return <Spinner size="small" />;
  }
  if (status === EStepItemStatus.Done) {
    return <Icon name="CheckRadioSolid" color="$iconSuccess" size="$6" />;
  }
  return <Icon name="XCircleSolid" color="$iconCritical" size="$6" />;
}
export interface IStepItemProviderProps {
  index: number;
}

const StepperItemContext = createContext<IStepItemProviderProps | undefined>(
  undefined,
);

export function useStepperItemContext() {
  const context = useContext(StepperItemContext);
  return context;
}

export function StepItemProvider({
  children,
  index,
}: PropsWithChildren<IStepItemProviderProps>) {
  const contextValue = useMemo(
    () => ({
      index,
    }),
    [index],
  );

  return (
    <StepperItemContext.Provider value={contextValue}>
      {children}
    </StepperItemContext.Provider>
  );
}

interface IStepperItemRenderProps {
  stepIndex: number;
  index?: number;
  status: EStepItemStatus;
}

export interface IStepItemProps {
  title: string;
  description?: string;
  renderDescription?: (props: IStepperItemRenderProps) => ReactElement | null;
  renderAction?: (props: IStepperItemRenderProps) => ReactElement | null;
  badgeText?: string;
}

export interface IStepperContextProps {
  stepIndex: number;
  stepsCount: number;
  isError?: boolean;
}

const StepperContext = createContext<IStepperContextProps | undefined>(
  undefined,
);

export function useStepperContext() {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error('useStepperContext must be used within a StepProvider');
  }
  return context;
}

export function StepItem({
  title,
  description,
  badgeText,
  renderDescription,
  renderAction,
}: IStepItemProps) {
  const { stepIndex, isError, stepsCount } = useStepperContext();
  const { index } = useStepperItemContext() || {};
  const status = useMemo(() => {
    if (index === undefined) {
      return EStepItemStatus.Inactive;
    }
    if (stepIndex < index) {
      return EStepItemStatus.Inactive;
    }
    if (stepIndex > index) {
      return EStepItemStatus.Done;
    }
    if (isError) {
      return EStepItemStatus.Failed;
    }
    return EStepItemStatus.Pending;
  }, [index, isError, stepIndex]);
  const renderProps = useMemo(
    () => ({
      status,
      stepIndex,
      index,
    }),
    [index, status, stepIndex],
  );
  return (
    <XStack gap="$3">
      <YStack ai="center">
        <Stack w="$6" h="$6" ai="center" jc="center">
          <StepItemStatus status={status} />
        </Stack>
        {index !== stepsCount - 1 ? (
          <Stack bg="$iconDisabled" w="$0.5" minHeight="$16" my="$2" flex={1} />
        ) : null}
      </YStack>
      <YStack gap="$2" flex={1}>
        <XStack h="$6" gap="$2" ai="center">
          <SizableText
            size={status === EStepItemStatus.Pending ? '$headingMd' : '$bodyLg'}
          >
            {title}
          </SizableText>
          {badgeText ? (
            <Badge badgeSize="lg" badgeType="success">
              <Badge.Text>{badgeText}</Badge.Text>
            </Badge>
          ) : null}
        </XStack>
        <SizableText size="$bodyLg" color="$textSubdued">
          {renderDescription ? renderDescription(renderProps) : description}
        </SizableText>
        {renderAction ? (
          <Stack mt="$2" mb="$8">
            {renderAction(renderProps)}
          </Stack>
        ) : null}
      </YStack>
    </XStack>
  );
}

export type IStepperProps = PropsWithChildren<
  Omit<IStepperContextProps, 'stepsCount'>
>;

function StepProvider({ children, stepIndex, isError }: IStepperProps) {
  const stepsCount = useMemo(() => Children.count(children), [children]);
  const contextValue = useMemo(
    () => ({ stepIndex, isError, stepsCount }),
    [stepIndex, isError, stepsCount],
  );

  return (
    <StepperContext.Provider value={contextValue}>
      {Children.map(children, (child, index) => (
        <StepItemProvider index={index}>{child}</StepItemProvider>
      ))}
    </StepperContext.Provider>
  );
}

export const Stepper = withStaticProperties(StepProvider, {
  Item: StepItem,
});
