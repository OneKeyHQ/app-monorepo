import UIKit

/// Tracks the software keyboard frame for every overlay entry, so an entry
/// presented while the keyboard is already up avoids it too.
final class NativeOverlayKeyboard {
  static let shared = NativeOverlayKeyboard()

  static let didChange = Notification.Name("NativeOverlayKeyboardDidChange")

  /// Screen coordinates; `.zero` while hidden.
  private(set) var frame: CGRect = .zero
  private(set) var duration: TimeInterval = 0.25
  private(set) var curve: UIView.AnimationCurve = .easeInOut

  private init() {
    let center = NotificationCenter.default
    center.addObserver(
      self,
      selector: #selector(keyboardWillChange(_:)),
      name: UIResponder.keyboardWillChangeFrameNotification,
      object: nil
    )
    center.addObserver(
      self,
      selector: #selector(keyboardWillHide(_:)),
      name: UIResponder.keyboardWillHideNotification,
      object: nil
    )
  }

  @objc private func keyboardWillChange(_ notification: Notification) {
    readAnimation(notification)
    let end = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect ?? .zero
    frame = end
    NotificationCenter.default.post(name: Self.didChange, object: self)
  }

  @objc private func keyboardWillHide(_ notification: Notification) {
    readAnimation(notification)
    frame = .zero
    NotificationCenter.default.post(name: Self.didChange, object: self)
  }

  private func readAnimation(_ notification: Notification) {
    let info = notification.userInfo
    duration = info?[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval ?? 0.25
    if let raw = info?[UIResponder.keyboardAnimationCurveUserInfoKey] as? Int,
       let value = UIView.AnimationCurve(rawValue: raw) {
      curve = value
    }
  }

  /// Keyboard top in `view`'s coordinates, or nil when it does not cover it.
  func top(in view: UIView) -> CGFloat? {
    guard frame.height > 0, let window = view.window else { return nil }
    let inWindow = window.convert(frame, from: window.screen.coordinateSpace)
    let local = view.convert(inWindow, from: window)
    guard local.minY < view.bounds.maxY else { return nil }
    return local.minY
  }
}

enum NativeOverlayKeyboardShift {
  /// Gap between centered content and the keyboard.
  static let margin: CGFloat = 16

  /**
   How far to lift an entry's content (points, >= 0).

   - Sheets rise until their content bottom clears the keyboard.
   - Other content rises until its bottom is `margin` above the keyboard.
   - Nothing rises above the top safe area; full-window content never moves.
   */
  static func compute(
    keyboardTop: CGFloat?,
    contentFrame: CGRect,
    contentBottom: CGFloat,
    isSheet: Bool,
    safeTop: CGFloat
  ) -> CGFloat {
    guard let keyboardTop else { return 0 }
    let needed = isSheet
      ? contentBottom - keyboardTop
      : contentFrame.maxY + margin - keyboardTop
    let room = contentFrame.minY - safeTop
    return max(0, min(needed, room))
  }
}
