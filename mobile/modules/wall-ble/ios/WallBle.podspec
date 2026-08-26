Pod::Spec.new do |s|
  s.name           = 'WallBle'
  s.version        = '1.0.0'
  s.summary        = 'Phone-to-phone BLE discovery for The Wall'
  s.description    = 'A local Expo module that lets iPhones advertise and discover The Wall peers.'
  s.author         = 'The Wall'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
