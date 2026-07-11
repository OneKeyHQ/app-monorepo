require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "OneKeyNativeComponents"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/OneKeyHQ/app-monorepo"
  s.license      = package["license"]
  s.authors      = "OneKey"

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/OneKeyHQ/app-monorepo.git", :tag => "#{s.version}" }
  s.source_files = [
    "ios/**/*.{swift}",
    "ios/**/*.{h,m,mm}",
    "cpp/**/*.{hpp,cpp}",
  ]

  s.dependency "React-jsi"
  s.dependency "React-callinvoker"
  s.dependency "SDWebImage", "~> 5.21.0"

  load "nitrogen/generated/ios/OneKeyNativeComponents+autolinking.rb"
  add_nitrogen_files(s)

  install_modules_dependencies(s)
end
