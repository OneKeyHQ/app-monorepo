### `PanResponder.create` 参数详解

以下是 `TradingView` 组件中 `PanResponder.create` 使用的参数及其作用：

1.  **`onStartShouldSetPanResponder: (evt, gestureState) => boolean`**
    *   **作用**: 当用户手指触摸到这个组件（在这里是 `Stack` 组件）时调用。决定：“这个组件是否应该**立刻**处理这次触摸？”
    *   **当前代码逻辑**: `(evt, gestureState) => { return gestureState.x0 < 50; }`
        *   只有当触摸起始点 (`x0`) 距离屏幕左边缘小于 50 像素时，才返回 `true`，尝试处理触摸。
        *   否则返回 `false`，让触摸事件传递给下层组件（如 `WebView`）。

2.  **`onMoveShouldSetPanResponder: (evt, gestureState) => boolean`**
    *   **作用**: 当用户手指按下后开始移动，但当前组件**尚未**成为事件处理者时调用。决定：“根据这次移动，这个组件**现在**是否应该开始处理触摸？”
    *   **当前代码逻辑**: `(evt, gestureState) => { const { dx, dy, x0 } = gestureState; return x0 < 50 && Math.abs(dx) > Math.abs(dy) && dx > 0; }`
        *   只有当触摸起始点 (`x0`) 在左边缘 50 像素内，**且**移动主要是水平向右时，才返回 `true`。
        *   这个逻辑专门用来识别从屏幕左边缘向右滑动的“返回”手势。

3.  **`onPanResponderGrant: (evt, gestureState) => void`**
    *   **作用**: 当组件成功获取触摸处理权时（即 `ShouldSet` 返回 `true` 且系统允许）调用。表示“授权成功，开始处理触摸”。
    *   **当前代码逻辑**: `(evt, gestureState) => { const { x0 } = gestureState; if (x0 < 50) { navigation.setOptions({ gesturesEnabled: true }); } }`
        *   如果触摸是从左边缘开始的，则启用 React Navigation 的原生侧滑返回手势。

4.  **`onPanResponderMove: (evt, gestureState) => void`**
    *   **作用**: 当组件**正在**处理触摸事件时，用户手指移动时持续调用。
    *   **当前代码逻辑**: `(evt, gestureState) => { const { dx, dy, x0 } = gestureState; if (x0 < 50 && Math.abs(dx) > Math.abs(dy) && dx > 0) { navigation.setOptions({ gesturesEnabled: true }); } else { navigation.setOptions({ gesturesEnabled: false }); } }`
        *   根据实时的移动判断是否符合“左边缘向右滑”的模式。
        *   如果符合，保持原生侧滑手势启用 (`gesturesEnabled: true`)。
        *   如果不符合（例如变为垂直滑动），则禁用原生手势 (`gesturesEnabled: false`)，防止误触。

5.  **`onPanResponderRelease: () => void`**
    *   **作用**: 当用户手指离开屏幕，触摸事件结束时调用。
    *   **当前代码逻辑**: `() => { navigation.setOptions({ gesturesEnabled: true }); }`
        *   触摸结束后，将原生侧滑手势恢复为默认的启用状态。

**总结:**

这套配置的目标是：仅当用户手势明确是从屏幕左侧边缘开始并向右滑动（典型的返回手势）时，才由 `Stack` 组件捕获该手势并控制导航行为。对于所有其他发生在 `WebView` 区域内的触摸交互（点击、滚动等），`Stack` 组件都不会干预，确保 `WebView` 的正常使用不受影响。