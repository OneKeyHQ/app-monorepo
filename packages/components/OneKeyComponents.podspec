require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "OneKeyComponents"
  s.version      = package["version"]
  s.summary      = "OneKey native components"
  s.homepage     = "https://github.com/OneKeyHQ/app-monorepo"
  s.license      = { :type => "MIT" }
  s.authors      = "OneKey"

  s.ios.deployment_target = "15.5"
  s.source       = { :git => "https://github.com/OneKeyHQ/app-monorepo.git" }
  s.source_files = "ios/**/*.{h,m,mm,cpp}"
  s.static_framework = true

  install_modules_dependencies(s)
end
