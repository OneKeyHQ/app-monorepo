---
name: implementing-figma-designs
description: Implements Figma designs 1:1 using OneKey component library. Use when implementing UI from Figma, converting designs to code, or building pages/components from design specs. Triggers on figma, design, UI, 还原设计稿, 切图, 页面, 组件, implementation, Button, Input, Badge, Icon, Stack, XStack, YStack, Dialog, Toast, Alert, Form, Select, Switch, Checkbox, Radio, Tabs, Popover, ActionList, Progress, Skeleton, Image, Avatar, Banner, Carousel, Table, Accordion, ScrollView, ListView, SectionList, Page, Divider, Empty, QRCode, Markdown, Spinner.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Implementing Figma Designs

This skill helps you implement Figma designs 1:1 using the OneKey component library. It maps Figma components to their code equivalents and provides usage demos.

## Core Principles

### Focus on UI First, Data Later

When implementing Figma designs, prioritize **pixel-perfect UI** over data integration:

1. **Use mock data** - Hardcode data that matches the design exactly
2. **Skip i18n** - Use plain strings directly from the design, no `intl.formatMessage`
3. **Skip API calls** - No need to fetch real data at this stage
4. **Match the design** - Focus on visual accuracy, spacing, colors, and layout

### What NOT to do at this stage

- ❌ Don't worry about where data comes from
- ❌ Don't add translation keys (ETranslations)
- ❌ Don't create API integration or hooks for fetching
- ❌ Don't add complex state management
- ❌ Don't over-engineer for edge cases not shown in design

### What TO do

- ✅ Hardcode text exactly as shown in Figma
- ✅ Create mock data arrays/objects that match the design
- ✅ Focus on component structure and styling
- ✅ Ensure responsive layout works
- ✅ Match spacing, colors, and typography from design

## Workflow

1. **Analyze the Figma design** using Figma MCP to extract component information
2. **Identify components** in the design and map them to OneKey components
3. **Create mock data** that matches what's shown in the design
4. **Implement the UI** with hardcoded values
5. **Reference component demos** in the Gallery for usage patterns

## Mock Data Examples

### List Data
```tsx
// Hardcode data matching the design
const mockTokens = [
  { name: 'Bitcoin', symbol: 'BTC', balance: '0.5234', value: '$21,432.50' },
  { name: 'Ethereum', symbol: 'ETH', balance: '3.2100', value: '$5,892.30' },
  { name: 'USDT', symbol: 'USDT', balance: '1,500.00', value: '$1,500.00' },
];
```

### Single Values
```tsx
// Just use the text from design directly
<SizableText>Total Balance</SizableText>
<Heading>$28,824.80</Heading>
<SizableText color="$textSubdued">+2.34% today</SizableText>
```

### Button Actions
```tsx
// Use console.log or empty functions for now
<Button onPress={() => console.log('Send clicked')}>Send</Button>
<Button onPress={() => {}}>Receive</Button>
```

### Images
```tsx
// Use placeholder or OneKey CDN URLs
<Image source={{ uri: 'https://uni.onekey-asset.com/static/chain/btc.png' }} />
<Image source={{ uri: 'https://via.placeholder.com/100' }} />
```

## Component Import

All components are imported from `@onekeyhq/components`:

```tsx
import {
  Button,
  Stack,
  XStack,
  YStack,
  // ... other components
} from '@onekeyhq/components';
```

## Component Categories

### Primitives (Basic Building Blocks)
| Component | Import Path | Demo |
|-----------|-------------|------|
| Button | `@onekeyhq/components` | [Button.tsx](reference/demos.md#button) |
| Stack/XStack/YStack | `@onekeyhq/components` | Layout containers |
| Icon | `@onekeyhq/components` | [Icon.tsx](reference/demos.md#icon) |
| Image | `@onekeyhq/components` | [Image.tsx](reference/demos.md#image) |
| SizeableText | `@onekeyhq/components` | Text with size variants |
| Heading | `@onekeyhq/components` | Heading text |
| Skeleton | `@onekeyhq/components` | [Skeleton.tsx](reference/demos.md#skeleton) |
| Spinner | `@onekeyhq/components` | Loading spinner |
| Anchor | `@onekeyhq/components` | [Anchor.tsx](reference/demos.md#anchor) |
| Label | `@onekeyhq/components` | Form labels |

### Forms
| Component | Import Path | Demo |
|-----------|-------------|------|
| Input | `@onekeyhq/components` | [Input.tsx](reference/demos.md#input) |
| TextArea | `@onekeyhq/components` | [TextArea.tsx](reference/demos.md#textarea) |
| Select | `@onekeyhq/components` | [Select.tsx](reference/demos.md#select) |
| Checkbox | `@onekeyhq/components` | [Checkbox.tsx](reference/demos.md#checkbox) |
| Radio | `@onekeyhq/components` | [Radio.tsx](reference/demos.md#radio) |
| Switch | `@onekeyhq/components` | [Switch.tsx](reference/demos.md#switch) |
| Slider | `@onekeyhq/components` | [Slider.tsx](reference/demos.md#slider) |
| Form | `@onekeyhq/components` | [Form.tsx](reference/demos.md#form) |
| OTPInput | `@onekeyhq/components` | [OTPInput.tsx](reference/demos.md#otpinput) |

### Actions
| Component | Import Path | Demo |
|-----------|-------------|------|
| IconButton | `@onekeyhq/components` | [IconButton.tsx](reference/demos.md#iconbutton) |
| ActionList | `@onekeyhq/components` | [ActionList.tsx](reference/demos.md#actionlist) |
| Alert | `@onekeyhq/components` | [Alert.tsx](reference/demos.md#alert) |
| Toast | `@onekeyhq/components` | [Toast.tsx](reference/demos.md#toast) |
| Popover | `@onekeyhq/components` | [Popover.tsx](reference/demos.md#popover) |
| Tooltip | `@onekeyhq/components` | Tooltip on hover |
| SegmentControl | `@onekeyhq/components` | [SegmentControl.tsx](reference/demos.md#segmentcontrol) |
| Pagination | `@onekeyhq/components` | [Pagination.tsx](reference/demos.md#pagination) |

### Composite
| Component | Import Path | Demo |
|-----------|-------------|------|
| Dialog | `@onekeyhq/components` | [Dialog.tsx](reference/demos.md#dialog) |
| Tabs | `@onekeyhq/components` | [Tabs.tsx](reference/demos.md#tabs) |
| Banner | `@onekeyhq/components` | [Banner.tsx](reference/demos.md#banner) |
| Carousel | `@onekeyhq/components` | [Carousel.tsx](reference/demos.md#carousel) |
| Table | `@onekeyhq/components` | [Table.tsx](reference/demos.md#table) |
| Stepper | `@onekeyhq/components` | [Stepper.tsx](reference/demos.md#stepper) |

### Content
| Component | Import Path | Demo |
|-----------|-------------|------|
| Badge | `@onekeyhq/components` | [Badge.tsx](reference/demos.md#badge) |
| Progress | `@onekeyhq/components` | [Progress.tsx](reference/demos.md#progress) |
| Empty | `@onekeyhq/components` | [Empty.tsx](reference/demos.md#empty) |
| Divider | `@onekeyhq/components` | [Divider.tsx](reference/demos.md#divider) |
| QRCode | `@onekeyhq/components` | [QRCode.tsx](reference/demos.md#qrcode) |
| Markdown | `@onekeyhq/components` | [Markdown.tsx](reference/demos.md#markdown) |
| LottieView | `@onekeyhq/components` | [LottieView.tsx](reference/demos.md#lottieview) |
| LinearGradient | `@onekeyhq/components` | [LinearGradient.tsx](reference/demos.md#lineargradient) |
| BlurView | `@onekeyhq/components` | [BlurView.tsx](reference/demos.md#blurview) |

### Layouts
| Component | Import Path | Demo |
|-----------|-------------|------|
| Page | `@onekeyhq/components` | Page container |
| ScrollView | `@onekeyhq/components` | [ScrollView.tsx](reference/demos.md#scrollview) |
| ListView | `@onekeyhq/components` | [ListView.tsx](reference/demos.md#listview) |
| SectionList | `@onekeyhq/components` | [SectionList.tsx](reference/demos.md#sectionlist) |
| Accordion | `@onekeyhq/components` | [Accordion.tsx](reference/demos.md#accordion) |
| Swiper | `@onekeyhq/components` | [Swiper.tsx](reference/demos.md#swiper) |
| SearchBar | `@onekeyhq/components` | Search input bar |

## Quick Reference

### Button Variants
```tsx
<Button>Secondary (default)</Button>
<Button variant="primary">Primary</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="tertiary">Tertiary</Button>
```

### Button Sizes
```tsx
<Button size="small">Small</Button>
<Button size="medium">Medium (default)</Button>
<Button size="large">Large</Button>
```

### Button States
```tsx
<Button disabled>Disabled</Button>
<Button loading>Loading</Button>
<Button icon="PlaceholderOutline">With Icon</Button>
<Button iconAfter="ArrowRightOutline">Icon After</Button>
```

### Input Variants
```tsx
<Input placeholder="Basic input" />
<Input size="small" placeholder="Small" />
<Input size="large" placeholder="Large" />
<Input leftIconName="SearchOutline" placeholder="With icon" />
<Input error placeholder="Error state" />
<Input disabled placeholder="Disabled" />
```

### Layout with Stack
```tsx
// Vertical stack
<Stack gap="$4">
  <Component1 />
  <Component2 />
</Stack>

// Horizontal stack
<XStack gap="$4" alignItems="center">
  <Component1 />
  <Component2 />
</XStack>

// Vertical stack (alias)
<YStack gap="$4">
  <Component1 />
  <Component2 />
</YStack>
```

### Spacing Tokens
- `$1` = 4px
- `$2` = 8px
- `$3` = 12px
- `$4` = 16px
- `$5` = 20px
- `$6` = 24px
- `$8` = 32px
- `$10` = 40px

### Color Tokens
- Text: `$text`, `$textSubdued`, `$textDisabled`
- Background: `$bg`, `$bgSubdued`, `$bgHover`, `$bgActive`
- Border: `$border`, `$borderSubdued`, `$borderActive`
- Icon: `$icon`, `$iconSubdued`, `$iconDisabled`

## Detailed Component Reference

For complete component documentation and demos, see [reference/demos.md](reference/demos.md).

For component source code, see [reference/components.md](reference/components.md).
