import type { MouseEventHandler, ReactNode } from 'react';

import {
  ButtonFrame,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';

import { DrawingIcon } from './DrawingToolbar';
import { DRAWING_TOOLS } from './model';

import type { IChartDrawingsController } from './useChartDrawings';

function InspectorButton({
  label,
  title = label,
  active,
  disabled,
  onClick,
  ...props
}: Omit<IButtonProps, 'color'> & {
  label: string;
  title?: string;
  active?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <ButtonFrame
      render={
        <button
          type="button"
          title={title}
          aria-label={label}
          onClick={onClick}
        />
      }
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      minWidth={0}
      padding={2}
      borderWidth={0}
      borderRadius={4}
      backgroundColor={active ? '$bgActive' : '$transparent'}
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? 0.3 : 1}
      hoverStyle={disabled ? undefined : { backgroundColor: '$bgHover' }}
      focusVisibleStyle={{
        outlineColor: '#2962ff',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: -2,
      }}
      {...props}
    />
  );
}

function DataSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack
      paddingVertical={10}
      paddingHorizontal={12}
      borderBottomWidth={1}
      borderColor="$borderSubdued"
    >
      <SizableText
        render="h4"
        margin={0}
        marginBottom={8}
        fontSize={12}
        lineHeight={18}
        fontWeight="600"
      >
        {title}
      </SizableText>
      <YStack render="dl" margin={0}>
        {children}
      </YStack>
    </YStack>
  );
}

function DataRow({
  label,
  children,
  testID,
  title,
}: {
  label: string;
  children: ReactNode;
  testID: string;
  title?: string;
}) {
  return (
    <XStack justifyContent="space-between" gap={12}>
      <SizableText
        render="dt"
        color="$textSubdued"
        fontSize={12}
        lineHeight={25}
        flexShrink={0}
      >
        {label}
      </SizableText>
      <SizableText
        render={<dd title={title} />}
        testID={testID}
        margin={0}
        minWidth={0}
        flexShrink={1}
        fontSize={12}
        lineHeight={25}
        fontVariant={['tabular-nums']}
        textAlign="right"
        wordWrap="break-word"
      >
        {children}
      </SizableText>
    </XStack>
  );
}

export function ChartInspector({
  controller,
}: {
  controller: IChartDrawingsController;
}) {
  const theme = useTheme();
  const { state } = controller;
  const selected = state.history.present.find(
    (drawing) => drawing.id === state.selectedId,
  );
  const selectedIndex = state.history.present.findIndex(
    (drawing) => drawing.id === state.selectedId,
  );
  const data = state.data;
  const date = data ? new Date(data.time * 1000).toISOString() : null;
  if (!state.panel) return null;

  return (
    <YStack
      render="section"
      testID="chart-inspector-panel"
      aria-label={
        state.panel === 'objects' ? 'Object Tree panel' : 'Data Window panel'
      }
      width={265}
      minHeight={0}
      flexShrink={0}
      backgroundColor="$bg"
      borderLeftWidth={1}
      borderColor="$borderSubdued"
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        minHeight={40}
        paddingHorizontal={12}
        borderBottomWidth={1}
        borderColor="$borderSubdued"
      >
        <SizableText fontSize={13} fontWeight="600">
          {state.panel === 'objects' ? 'Object Tree' : 'Data Window'}
        </SizableText>
        <InspectorButton
          label="Collapse chart panel"
          title="Collapse"
          width={24}
          height={26}
          onPress={() => controller.togglePanel(state.panel ?? 'objects')}
        >
          <DrawingIcon name="chevron" color={theme.text.val} />
        </InspectorButton>
      </XStack>
      <ScrollView minHeight={0} flex={1}>
        {state.panel === 'objects' ? (
          <YStack
            render="ul"
            aria-label="Drawing objects"
            margin={0}
            paddingHorizontal={0}
            paddingVertical={5}
          >
            {[...state.history.present].toReversed().map((drawing) => {
              const label = drawing.name || DRAWING_TOOLS[drawing.tool].label;
              const isSelected = state.selectedIds.includes(drawing.id);
              const isHidden = drawing.hidden || state.hidden;
              return (
                <XStack
                  key={drawing.id}
                  render={
                    <li
                      data-object-id={drawing.id}
                      data-selected={isSelected}
                      data-hidden={isHidden}
                    />
                  }
                  testID="chart-object"
                  alignItems="center"
                  minHeight={38}
                  paddingHorizontal={5}
                  gap={1}
                  backgroundColor={isSelected ? '$bgActive' : '$transparent'}
                >
                  <InspectorButton
                    label={`Select ${label}`}
                    title={label}
                    active={isSelected}
                    flex={1}
                    minWidth={0}
                    justifyContent="flex-start"
                    gap={6}
                    opacity={isHidden ? 0.5 : 1}
                    onClick={(event) =>
                      controller.selectDrawing(
                        drawing.id,
                        event.ctrlKey || event.metaKey,
                      )
                    }
                  >
                    <DrawingIcon
                      name={drawing.tool}
                      color={isSelected ? '#2962ff' : theme.text.val}
                    />
                    <SizableText
                      fontSize={12}
                      lineHeight={16}
                      color={isSelected ? '#2962ff' : '$text'}
                      minWidth={0}
                      flexShrink={1}
                      numberOfLines={1}
                    >
                      {label}
                    </SizableText>
                  </InspectorButton>
                  <InspectorButton
                    label={`${drawing.hidden ? 'Show' : 'Hide'} ${label}`}
                    title={drawing.hidden ? 'Show' : 'Hide'}
                    width={25}
                    height={28}
                    onPress={() =>
                      controller.updateDrawing(drawing.id, {
                        hidden: !drawing.hidden,
                      })
                    }
                  >
                    <DrawingIcon
                      name={drawing.hidden ? 'show' : 'hide'}
                      color={theme.text.val}
                    />
                  </InspectorButton>
                  <InspectorButton
                    label={`${drawing.locked ? 'Unlock' : 'Lock'} ${label}`}
                    title={drawing.locked ? 'Unlock' : 'Lock'}
                    width={25}
                    height={28}
                    disabled={state.locked}
                    onPress={() =>
                      controller.updateDrawing(drawing.id, {
                        locked: !drawing.locked,
                      })
                    }
                  >
                    <DrawingIcon
                      name={drawing.locked ? 'lock' : 'unlock'}
                      color={theme.text.val}
                    />
                  </InspectorButton>
                  <InspectorButton
                    label={`Delete ${label}`}
                    title="Delete"
                    width={25}
                    height={28}
                    disabled={drawing.locked || state.locked}
                    onPress={() => controller.removeDrawing(drawing.id)}
                  >
                    <DrawingIcon name="delete" color={theme.text.val} />
                  </InspectorButton>
                </XStack>
              );
            })}
            {!state.history.present.length ? (
              <SizableText
                render="li"
                display="block"
                paddingVertical={20}
                paddingHorizontal={14}
                color="$textSubdued"
                fontSize={12}
                lineHeight={20}
              >
                Drawings on this chart will appear here.
              </SizableText>
            ) : null}
          </YStack>
        ) : null}
        {state.panel === 'data' && data ? (
          <>
            <DataSection
              title={data.historical ? 'Selected bar' : 'Latest bar'}
            >
              <DataRow label="Date" testID="chart-data-date">
                {date?.slice(0, 10)}
              </DataRow>
              <DataRow label="Time (UTC)" testID="chart-data-time">
                {date?.slice(11, 19)}
              </DataRow>
            </DataSection>
            {data.groups.map((group, index) => (
              <DataSection title={group.name} key={`${group.name}-${index}`}>
                {group.rows.map((row) => (
                  <DataRow
                    key={row.name}
                    label={row.name}
                    testID={`chart-data-${row.name}`}
                    title={String(row.value ?? '')}
                  >
                    {row.value !== null && Number.isFinite(row.value)
                      ? row.value.toLocaleString('en-US', {
                          maximumSignificantDigits: 10,
                        })
                      : '—'}
                  </DataRow>
                ))}
              </DataSection>
            ))}
          </>
        ) : null}
        {state.panel === 'data' && !data ? (
          <SizableText
            paddingVertical={20}
            paddingHorizontal={14}
            color="$textSubdued"
            fontSize={12}
            lineHeight={20}
          >
            Waiting for chart data…
          </SizableText>
        ) : null}
      </ScrollView>
      {state.panel === 'objects' && selected ? (
        <YStack padding={10} borderTopWidth={1} borderColor="$borderSubdued">
          <XStack render="label" alignItems="center" gap={8}>
            <SizableText fontSize={12}>Name</SizableText>
            <SizableText
              render={
                <input
                  aria-label="Object name"
                  key={`${selected.id}-${selected.name ?? ''}`}
                  maxLength={100}
                  defaultValue={
                    selected.name ?? DRAWING_TOOLS[selected.tool].label
                  }
                  disabled={selected.locked || state.locked}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name !== selected.name)
                      controller.updateDrawing(selected.id, { name });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
              }
              flex={1}
              minWidth={0}
              color="$text"
              backgroundColor="$bg"
              borderWidth={1}
              borderColor="$borderSubdued"
              borderRadius={4}
              padding={6}
              fontSize={12}
              lineHeight={16}
              focusVisibleStyle={{
                outlineColor: '#2962ff',
                outlineWidth: 2,
                outlineStyle: 'solid',
                outlineOffset: -2,
              }}
            />
          </XStack>
          <XStack gap={8} marginTop={8}>
            <InspectorButton
              label="Bring drawing forward"
              flex={1}
              gap={8}
              padding={6}
              borderWidth={1}
              borderColor="$borderSubdued"
              disabled={
                selected.locked ||
                state.locked ||
                selectedIndex === state.history.present.length - 1
              }
              onPress={() => controller.reorderDrawing(selected.id, 1)}
            >
              <SizableText fontSize={12} lineHeight={16}>
                Bring forward
              </SizableText>
            </InspectorButton>
            <InspectorButton
              label="Send drawing backward"
              flex={1}
              gap={8}
              padding={6}
              borderWidth={1}
              borderColor="$borderSubdued"
              disabled={selected.locked || state.locked || selectedIndex === 0}
              onPress={() => controller.reorderDrawing(selected.id, -1)}
            >
              <SizableText fontSize={12} lineHeight={16}>
                Send backward
              </SizableText>
            </InspectorButton>
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  );
}
