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
  switch (status) {
    case EStepItemStatus.Inactive:
      return <Icon name="CirclePlaceholderOnOutline" color="$iconDisabled" />;
    case EStepItemStatus.Pending:
      return <Spinner size="small" />;
    case EStepItemStatus.Done:
      return <Icon name="CheckRadioSolid" color="$iconSuccess" />;
    default:
      return <Icon name="XCircleSolid" color="$iconCritical" />;
  }
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
  hasError?: boolean;
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
  const { stepIndex, hasError, stepsCount } = useStepperContext();
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
    if (hasError) {
      return EStepItemStatus.Failed;
    }
    return EStepItemStatus.Pending;
  }, [index, hasError, stepIndex]);
  const renderProps = useMemo(
    () => ({
      status,
      stepIndex,
      index,
    }),
    [index, status, stepIndex],
  );
  return (
    <XStack gap="$3" pb="$10">
      <YStack w="$6" h="$6" ai="center" jc="center">
        <StepItemStatus status={status} />
      </YStack>
      <YStack gap="$4" flex={1}>
        <YStack gap="$2">
          <XStack gap="$2" ai="center">
            <SizableText
              size={
                status === EStepItemStatus.Pending ? '$headingMd' : '$bodyLg'
              }
            >
              {title}
            </SizableText>
            {badgeText ? (
              <Badge badgeSize="lg" badgeType="success">
                <Badge.Text>{badgeText}</Badge.Text>
              </Badge>
            ) : null}
          </XStack>
          {renderDescription ? renderDescription(renderProps) : null}
          {description ? (
            <SizableText size="$bodyLg" color="$textSubdued">
              {description}
            </SizableText>
          ) : null}
        </YStack>
        {renderAction ? renderAction(renderProps) : null}
      </YStack>
      {index !== stepsCount - 1 ? (
        <Stack
          flex={1}
          position="absolute"
          left={11}
          top="$8"
          bottom="$2"
          w="$0.5"
          bg="$iconDisabled"
          borderRadius="$full"
        />
      ) : null}
    </XStack>
  );
}

export type IStepperProps = PropsWithChildren<
  Omit<IStepperContextProps, 'stepsCount'>
>;

function StepProvider({ children, stepIndex, hasError }: IStepperProps) {
  const stepsCount = useMemo(() => Children.count(children), [children]);
  const contextValue = useMemo(
    () => ({ stepIndex, hasError, stepsCount }),
    [stepIndex, hasError, stepsCount],
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
