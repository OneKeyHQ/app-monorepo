# Add Icon to Components Package

Execute the following workflow to add a new icon to the components package:

## Arguments

- `$ARGUMENTS`: The icon name and SVG content or file path

## Workflow Steps

1. **Parse the icon information**
   - Extract icon name from arguments (e.g., `atom`, `user-profile`)
   - Determine icon type: `outline`, `solid`, `brand`, `colored`, `custom`, or `illus`
   - Default to `outline` if not specified

2. **Prepare the SVG file**
   - SVG directory: `packages/components/svg/<type>/`
   - File naming: use kebab-case (e.g., `atom.svg`, `user-profile.svg`)
   - **CRITICAL**: Ensure SVG uses `fill="currentColor"` or `stroke="currentColor"` instead of hardcoded colors like `fill="black"` or `fill="#000"`
   - Standard viewBox: `0 0 24 24` (or as provided)

3. **Create the SVG file**
   - Create file at `packages/components/svg/<type>/<icon-name>.svg`
   - Ensure proper SVG structure:
     ```xml
     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
       <path ... fill="currentColor"/>
     </svg>
     ```

4. **Generate React components**
   - Navigate to components package: `cd packages/components`
   - Run the icon build command: `yarn icon:build`
   - This will:
     - Convert SVG to React Native compatible TSX component
     - Update the index.ts exports automatically
     - Update Icons.tsx type definitions

5. **Verify the generated files**
   - Check that `src/primitives/Icon/react/<type>/<IconName>.tsx` was created
   - Check that the icon is exported in `src/primitives/Icon/react/<type>/index.ts`
   - Icon name in code will be PascalCase (e.g., `atom.svg` → `Atom.tsx`)

6. **Usage in code**
   - Import pattern: `<Icon name="<IconName><Type>" />`
   - Examples:
     - `outline/atom.svg` → `<Icon name="AtomOutline" />`
     - `solid/atom.svg` → `<Icon name="AtomSolid" />`

## Key Points

- **Color**: Always use `currentColor` for fill/stroke to allow dynamic coloring
- **Naming**: SVG files use kebab-case, generated components use PascalCase
- **Build**: Must run `yarn icon:build` after adding SVG to generate components
- **Types**: Icon types are automatically updated in `Icons.tsx`

## Example

```bash
# Add an outline icon named "atom"
# 1. Create: packages/components/svg/outline/atom.svg
# 2. Run: cd packages/components && yarn icon:build
# 3. Use: <Icon name="AtomOutline" />
```
