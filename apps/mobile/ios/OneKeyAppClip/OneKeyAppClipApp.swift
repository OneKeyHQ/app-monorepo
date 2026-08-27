import SwiftUI

@main
struct OneKeyAppClipApp: App {
  @Environment(\.scenePhase) private var scenePhase
  @StateObject private var model = AppClipModel()

  var body: some Scene {
    WindowGroup {
      AppClipRootView(model: model)
        .task {
          model.start()
        }
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
          guard let url = activity.webpageURL else {
            return
          }
          model.handleInvocation(url)
        }
        .onChange(of: scenePhase) { phase in
          if phase == .active {
            model.appDidBecomeActive()
          }
        }
    }
  }
}
