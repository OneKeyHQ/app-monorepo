Pod::Spec.new do |s|
  s.name     = 'TOCropViewController'
  s.version  = '2.8.1'
  s.license  = { :type => 'MIT', :file => 'LICENSE' }
  s.summary  = 'A view controller that enables cropping and rotation of UIImage objects.'
  s.homepage = 'https://github.com/OneKeyHQ/app-modules'
  s.author   = 'Tim Oliver'
  s.source   = { :git => 'https://github.com/OneKeyHQ/app-modules.git', :commit => '2ba1a0b' }
  s.platform = :ios, '12.0'
  s.source_files = 'Objective-C/TOCropViewController/**/*.{h,m}'
  s.exclude_files = 'Objective-C/TOCropViewController/include/**/*.h'
  s.resource_bundles = {
    'TOCropViewControllerBundle' => ['Objective-C/TOCropViewController/**/*.{lproj,xcprivacy}']
  }
  s.requires_arc = true
end
