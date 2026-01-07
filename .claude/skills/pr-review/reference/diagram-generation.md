# Diagram Generation Reference

## Using the Diagram Tool

Use `mcp__figma-remote-mcp__generate_diagram` to create Mermaid diagrams in FigJam.

### Supported Diagram Types

1. **Flowchart / Graph** (`graph` or `flowchart`)
2. **Sequence Diagram** (`sequenceDiagram`)
3. **State Diagram** (`stateDiagram-v2`)
4. **Gantt Chart** (`gantt`)

## Flowchart Patterns for PR Review

### File Dependency Graph Template

```mermaid
graph LR
    subgraph "Changed Files"
        F1["changed-file-1.ts"]
        F2["changed-file-2.ts"]
    end

    subgraph "Direct Dependencies"
        D1["dependency-1.ts"]
        D2["dependency-2.ts"]
    end

    subgraph "Affected Consumers"
        C1["consumer-1.ts"]
        C2["consumer-2.ts"]
    end

    F1 -->|"imports"| D1
    F2 -->|"imports"| D2
    C1 -->|"imports"| F1
    C2 -->|"imports"| F2
```

### Package Layer Diagram Template

```mermaid
graph TD
    subgraph "Apps Layer"
        A1["desktop"]
        A2["mobile"]
        A3["ext"]
        A4["web"]
    end

    subgraph "Kit Layer"
        K["@onekeyhq/kit"]
    end

    subgraph "Background Layer"
        BG["@onekeyhq/kit-bg"]
    end

    subgraph "Core Layer"
        C["@onekeyhq/core"]
        COMP["@onekeyhq/components"]
    end

    subgraph "Shared Layer"
        S["@onekeyhq/shared"]
    end

    A1 --> K
    A2 --> K
    A3 --> K
    A4 --> K
    K --> BG
    K --> COMP
    BG --> C
    BG --> S
    C --> S
    COMP --> S
```

### Data Flow Template

```mermaid
graph LR
    subgraph "Input"
        I1["User Action"]
        I2["External Event"]
    end

    subgraph "Processing"
        P1["Validation"]
        P2["Transform"]
        P3["Business Logic"]
    end

    subgraph "Side Effects"
        S1["API Call"]
        S2["State Update"]
        S3["Storage"]
    end

    subgraph "Output"
        O1["UI Update"]
        O2["Notification"]
    end

    I1 --> P1
    I2 --> P1
    P1 --> P2
    P2 --> P3
    P3 --> S1
    P3 --> S2
    P3 --> S3
    S1 --> O1
    S2 --> O1
    S3 --> O2
```

## Sequence Diagram Patterns

### API Request Flow Template

```mermaid
sequenceDiagram
    participant UI as UI Component
    participant Hook as useXxx Hook
    participant BG as Background Service
    participant API as External API

    UI->>Hook: triggerAction()
    Hook->>BG: backgroundApiProxy.serviceXxx.method()
    BG->>API: fetch(endpoint)
    API-->>BG: response
    BG-->>Hook: result
    Hook-->>UI: update state
    UI->>UI: re-render
```

### Hardware Wallet Interaction Template

```mermaid
sequenceDiagram
    participant U as User
    participant App as App UI
    participant HW as Hardware SDK
    participant Device as Hardware Device

    U->>App: Initiate signing
    App->>HW: prepareTransaction()
    HW->>Device: Connect
    Device-->>HW: Connected
    HW->>Device: Send TX data
    Device->>U: Confirm on device
    U->>Device: Physical confirmation
    Device-->>HW: Signature
    HW-->>App: Signed TX
    App->>App: Broadcast TX
```

## State Diagram Patterns

### Loading State Template

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Loading: fetch()
    Loading --> Success: resolve
    Loading --> Error: reject
    Success --> Idle: reset
    Error --> Loading: retry
    Error --> Idle: dismiss

    state Success {
        [*] --> DataReady
        DataReady --> Refreshing: refresh()
        Refreshing --> DataReady: done
    }
```

### Transaction State Template

```mermaid
stateDiagram-v2
    [*] --> Draft

    Draft --> Validating: submit
    Validating --> Ready: valid
    Validating --> Draft: invalid

    Ready --> Signing: sign
    Signing --> Signed: success
    Signing --> Ready: cancelled

    Signed --> Broadcasting: broadcast
    Broadcasting --> Confirmed: mined
    Broadcasting --> Failed: timeout

    Confirmed --> [*]
    Failed --> Ready: retry
```

## Styling Guidelines

### Risk Level Colors

```mermaid
graph LR
    A["Critical Risk"]
    B["High Risk"]
    C["Medium Risk"]
    D["Low Risk"]

    style A fill:#ff6b6b,stroke:#333,color:#fff
    style B fill:#ffa94d,stroke:#333
    style C fill:#ffd43b,stroke:#333
    style D fill:#69db7c,stroke:#333
```

### Platform Colors

```mermaid
graph LR
    A["Extension"]
    B["Mobile"]
    C["Desktop"]
    D["Web"]

    style A fill:#845ef7,stroke:#333,color:#fff
    style B fill:#339af0,stroke:#333,color:#fff
    style C fill:#20c997,stroke:#333
    style D fill:#ff922b,stroke:#333
```

## Best Practices

### Do

- Keep node labels short (use abbreviations)
- Use subgraphs to group related items
- Add edge labels for clarity
- Use consistent direction (LR for flows, TD for hierarchies)
- Highlight the changed/new parts

### Don't

- Create diagrams with more than 20 nodes
- Use complex styling that distracts
- Include implementation details in labels
- Mix different abstraction levels

### When to Use Each Type

| Diagram Type | Use When |
|-------------|----------|
| `graph LR` | File dependencies, data flow |
| `graph TD` | Component hierarchy, package structure |
| `sequenceDiagram` | API calls, async operations, user flows |
| `stateDiagram-v2` | State machines, loading states |
| `gantt` | Task planning (rarely used in PR review) |

## Example Tool Call

```typescript
// Generate a file dependency diagram
mcp__figma-remote-mcp__generate_diagram({
  name: "PR #123 File Dependencies",
  userIntent: "Show how changed files relate to each other",
  mermaidSyntax: `graph LR
    subgraph "Changed"
        A["useWallet.ts"]
        B["WalletService.ts"]
    end
    subgraph "Affected"
        C["HomePage.tsx"]
        D["SettingsPage.tsx"]
    end
    A --> B
    C --> A
    D --> A`
})
```
