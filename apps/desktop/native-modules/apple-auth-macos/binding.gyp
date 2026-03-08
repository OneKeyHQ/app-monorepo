{
  "targets": [
    {
      "target_name": "apple_auth",
      "conditions": [
        ["OS=='mac'", {
          "sources": [
            "src/apple_auth.mm"
          ],
          "include_dirs": [
            "<!@(node -p \"require('node-addon-api').include\")"
          ],
          "defines": [
            "NAPI_DISABLE_CPP_EXCEPTIONS"
          ],
          "xcode_settings": {
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "OTHER_LDFLAGS": [
              "-framework AuthenticationServices",
              "-framework Foundation",
              "-framework AppKit"
            ]
          }
        }]
      ]
    }
  ]
}

