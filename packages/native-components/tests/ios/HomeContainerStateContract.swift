import Foundation

enum HomeContainerStateContractError: Error {
  case assertion(String)
}

@main
enum HomeContainerStateContract {
  static func main() throws {
    guard CommandLine.arguments.count == 2 else {
      throw HomeContainerStateContractError.assertion("Expected one state fixture")
    }
    let data = Data(CommandLine.arguments[1].utf8)
    let state = try JSONDecoder().decode(HomeContainerState.self, from: data)
    guard state.isValid,
          state.payload.selectedTabId == "portfolio" else {
      throw HomeContainerStateContractError.assertion("Valid state was rejected")
    }
  }
}
