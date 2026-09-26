require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NativeOverlay"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/OneKeyHQ/app-modules"
  s.license      = package["license"]
  s.authors      = "@onekeyfe"

  s.platforms    = { :ios => '16.0' }
  s.source       = { :git => "https://github.com/OneKeyHQ/app-modules.git", :tag => "#{s.version}" }

  s.source_files = [
    "ios/**/*.h",
    "ios/**/*.{swift}",
    "ios/**/*.{m,mm}",
  ]
  s.exclude_files = "ios/tests/**/*"
  s.swift_version = '5.0'
  install_modules_dependencies(s)
end
