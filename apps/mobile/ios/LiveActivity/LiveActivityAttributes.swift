import ActivityKit

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    let progress: Int
  }

  let title: String
}
