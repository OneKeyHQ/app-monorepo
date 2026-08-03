import UIKit

extension UIColor {
  convenience init(homeContainerColor value: String, fallback: UIColor = .clear) {
    var hex = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") {
      hex.removeFirst()
    }

    guard hex.count == 6 || hex.count == 8,
          let raw = UInt64(hex, radix: 16) else {
      self.init(cgColor: fallback.cgColor)
      return
    }

    let hasAlpha = hex.count == 8
    let red = CGFloat((raw >> (hasAlpha ? 24 : 16)) & 0xFF) / 255
    let green = CGFloat((raw >> (hasAlpha ? 16 : 8)) & 0xFF) / 255
    let blue = CGFloat((raw >> (hasAlpha ? 8 : 0)) & 0xFF) / 255
    let alpha = hasAlpha ? CGFloat(raw & 0xFF) / 255 : 1
    self.init(red: red, green: green, blue: blue, alpha: alpha)
  }
}
