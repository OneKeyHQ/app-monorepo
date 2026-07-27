import Foundation

@main
enum HomeContainerProtocolV3Contract {
  private static let decoder = JSONDecoder()

  static func main() throws {
    guard CommandLine.arguments.count == 3 else {
      throw ContractError.invalidArguments
    }
    let snapshot = try decoder.decode(
      HomeContainerProtocolV3SnapshotEnvelope.self,
      from: Data(CommandLine.arguments[1].utf8)
    )
    let domains = try decoder.decode(
      HomeContainerProtocolV3DomainBatch.self,
      from: Data(CommandLine.arguments[2].utf8)
    )
    let initial = try applied(
      HomeContainerProtocolV3Transaction.apply(snapshot: snapshot)
    )
    try expect(initial.identity.storeCommitId == 7)
    try expect(initial.snapshot.header.balance == "$100.00")

    var sectionCommands = initial.authorityRevisions.sectionCommands
    sectionCommands["portfolio"] = 10
    let current = HomeContainerProtocolV3State(
      identity: initial.identity,
      presentationRevisions: initial.presentationRevisions,
      authorityRevisions: HomeContainerProtocolV3AuthorityRevisions(
        shellCommands: initial.authorityRevisions.shellCommands,
        tabApplicability: initial.authorityRevisions.tabApplicability,
        sectionCommands: sectionCommands
      ),
      snapshot: initial.snapshot
    )
    let next = try applied(
      HomeContainerProtocolV3Transaction.apply(
        domains: domains,
        current: current
      )
    )
    try expect(next.identity.storeCommitId == 8)
    try expect(next.snapshot.selectedTabId == "history")
    try expect(next.snapshot.header.balance == "$101.00")
    try expect(next.authorityRevisions.sectionCommands["portfolio"] == 10)

    let oldOwner = HomeContainerProtocolV3DomainBatch(
      kind: domains.kind,
      protocolVersion: domains.protocolVersion,
      identity: HomeContainerProtocolV3Identity(
        scopeKey: domains.identity.scopeKey,
        sessionId: "old-session",
        storeCommitId: domains.identity.storeCommitId
      ),
      updates: domains.updates
    )
    guard case .ignored = HomeContainerProtocolV3Transaction.apply(
      domains: oldOwner,
      current: next
    ) else {
      throw ContractError.expectedIgnored
    }

    var queue = HomeContainerTabSelectionQueue()
    queue.replacePending(
      with: HomeContainerTabSelectionRequest(
        tabId: "perps",
        animated: true,
        notify: true
      )
    )
    queue.replacePending(
      with: HomeContainerTabSelectionRequest(
        tabId: "defi",
        animated: true,
        notify: true
      )
    )
    try expect(queue.takePending()?.tabId == "defi")
  }

  private static func applied(
    _ outcome: HomeContainerProtocolV3ApplyOutcome
  ) throws -> HomeContainerProtocolV3State {
    guard case .applied(let state, _) = outcome else {
      throw ContractError.expectedApplied
    }
    return state
  }

  private static func expect(_ condition: @autoclosure () -> Bool) throws {
    guard condition() else { throw ContractError.failedExpectation }
  }

  private enum ContractError: Error {
    case expectedApplied
    case expectedIgnored
    case failedExpectation
    case invalidArguments
  }
}
