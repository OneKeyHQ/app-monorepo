// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OneKeyRevenueCat",
    platforms: [.macOS(.v11)],
    products: [
        .library(name: "OneKeyRevenueCat", type: .dynamic, targets: ["OneKeyRevenueCat"])
    ],
    dependencies: [
        // Keep both versions aligned with apps/mobile/ios/Podfile.lock.
        .package(url: "https://github.com/RevenueCat/purchases-hybrid-common", exact: "18.21.0"),
        .package(url: "https://github.com/RevenueCat/purchases-ios-spm", exact: "5.80.3")
    ],
    targets: [
        .target(
            name: "OneKeyRevenueCat",
            dependencies: [
                .product(name: "PurchasesHybridCommon", package: "purchases-hybrid-common"),
                .product(name: "RevenueCat", package: "purchases-ios-spm")
            ]
        )
    ]
)
