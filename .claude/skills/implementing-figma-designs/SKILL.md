---
name: implementing-figma-designs
description: Implements Figma designs 1:1 using OneKey component library (还原设计稿).
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Implementing Figma Designs

This skill helps you implement Figma designs 1:1 using the OneKey component library.

## Core Principles

### Focus on UI First, Data Later

When implementing Figma designs, prioritize **pixel-perfect UI** over data integration:

1. **Use mock data** - Hardcode data that matches the design exactly
2. **Skip i18n** - Use plain strings directly from the design, no `intl.formatMessage`
3. **Skip API calls** - No need to fetch real data at this stage
4. **Match the design** - Focus on visual accuracy, spacing, colors, and layout

### What NOT to do

- Don't worry about where data comes from
- Don't add translation keys (ETranslations)
- Don't create API integration or hooks for fetching
- Don't add complex state management

### What TO do

- Hardcode text exactly as shown in Figma
- Create mock data arrays/objects that match the design
- Focus on component structure and styling
- Match spacing, colors, and typography from design

## Component Lookup (On-Demand)

When you need to use a component, look up its source and demo:

### Source Code Location Pattern

```text
packages/components/src/{category}/{ComponentName}/
```

Categories:

- `primitives/` - Button, Icon, Image, Skeleton, Spinner, Stack, Heading, SizeableText
- `forms/` - Input, TextArea, Select, Checkbox, Radio, Switch, Slider, Form, OTPInput
- `actions/` - IconButton, ActionList, Alert, Toast, Popover, SegmentControl, Pagination, Tooltip
- `composite/` - Dialog, Tabs, Banner, Carousel, Table, Stepper
- `content/` - Badge, Progress, Empty, Divider, QRCode, Markdown, LottieView, LinearGradient, BlurView
- `layouts/` - Page, ScrollView, ListView, SectionList, Accordion, Swiper, SearchBar

### Demo Location Pattern

```text
packages/kit/src/views/Developer/pages/Gallery/Components/stories/{ComponentName}.tsx
```

Note: Some demos have different names (e.g., `AccordionGallery.tsx`, `NewTabsGallery.tsx`)

### How to Look Up a Component

1. **Read the source** to understand props and structure:

   ```text
   Read: packages/components/src/{category}/{ComponentName}/index.tsx
   ```

2. **Read the demo** for usage examples:

   ```text
   Glob: packages/kit/src/views/Developer/pages/Gallery/Components/stories/*{ComponentName}*.tsx
   ```

## Quick Reference

### All imports from `@onekeyhq/components`

```tsx
import { Button, Stack, XStack, YStack, Icon, ... } from '@onekeyhq/components';
```

### Spacing Tokens

- `$1` = 4px, `$2` = 8px, `$3` = 12px, `$4` = 16px
- `$5` = 20px, `$6` = 24px, `$8` = 32px, `$10` = 40px

### Color Tokens

- Text: `$text`, `$textSubdued`, `$textDisabled`
- Background: `$bg`, `$bgSubdued`, `$bgHover`, `$bgActive`
- Border: `$border`, `$borderSubdued`, `$borderActive`
- Icon: `$icon`, `$iconSubdued`, `$iconDisabled`

### Font Size Tokens

Headings (large to small):

- `$headingXxl`, `$headingXl`, `$headingLg`, `$headingMd`, `$headingSm`, `$headingXs`

Body text (large to small):

- `$bodyLg`, `$bodyMd`, `$bodySm`, `$bodyXs`

With medium weight (append `Medium`):

- `$bodyLgMedium`, `$bodyMdMedium`, `$bodySmMedium`, `$bodyXsMedium`

Usage with SizableText:

```tsx
<SizableText size="$bodyMd">Regular text</SizableText>
<SizableText size="$bodyMdMedium">Medium weight text</SizableText>
<SizableText size="$headingSm">Small heading</SizableText>
```

### Common Patterns

**Layout with Stack:**

```tsx
<YStack gap="$4">        {/* Vertical */}
<XStack gap="$4">        {/* Horizontal */}
<Stack gap="$4">         {/* Default vertical */}
```

**Mock Data:**

```tsx
const mockItems = [
  { name: 'Bitcoin', symbol: 'BTC', value: '$21,432.50' },
  { name: 'Ethereum', symbol: 'ETH', value: '$5,892.30' },
];
```

**Button Actions:**

```tsx
<Button onPress={() => console.log('clicked')}>Action</Button>
```

## Workflow

1. Analyze the Figma design using Figma MCP
2. Identify which components are needed
3. **Look up each component** - read source and demo on-demand
4. Create mock data matching the design
5. Implement the UI with hardcoded values
