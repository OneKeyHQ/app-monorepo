Unicode true
RequestExecutionLevel user
SilentInstall normal
Name "OneKey Native UI Fixture"
OutFile "${OUTPUT_FILE}"
!addplugindir "${PLUGIN_DIR}"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
Page custom ShowFixture
Page instfiles

Var Mode
Var Locale
Var InitialPage
Var SimulatedDpi
Var Log
Var Result
Var Retry

!macro Call COMMAND ARGUMENTS
  onekey-installer-ui::${COMMAND} /NOUNLOAD ${ARGUMENTS}
  Pop $Result
!macroend

!macro Record LABEL
  FileWrite $Log "${LABEL}=$Result$\r$\n"
!macroend

Function .onInit
  ${GetParameters} $0
  ${GetOptions} $0 "/MODE=" $Mode
  ${GetOptions} $0 "/LOCALE=" $Locale
  ${GetOptions} $0 "/PAGE=" $InitialPage
  ${GetOptions} $0 "/DPI=" $SimulatedDpi

  ${If} $Locale == ""
    StrCpy $Locale "en-US"
  ${EndIf}
  ${If} $InitialPage == ""
    StrCpy $InitialPage "welcome"
  ${EndIf}

  FileOpen $Log "$EXEDIR\fixture-events.txt" w
  !insertmacro Call Init '"$Locale" "6.6.0"'
  !insertmacro Record init
  ${If} $Result != "ok"
    SetErrorLevel 2
    Quit
  ${EndIf}
FunctionEnd

Function .onGUIInit
  !insertmacro Call ConcealHost ""
  !insertmacro Record conceal
FunctionEnd

Function ShowFixture
  !insertmacro Call SetPage '""'
  !insertmacro Record unknown-page
  !insertmacro Call SetPage '"$InitialPage"'
  !insertmacro Record page
  !insertmacro Call SetPerUserInstallDirectory '"C:\Fixture\Current"'
  !insertmacro Call SetPerMachineInstallDirectory '"C:\Fixture\All"'
  !insertmacro Call SetInstallDirectory '"C:\Fixture\OneKey"'
  !insertmacro Call ResetProgress '"27"'
  !insertmacro Call Show ""
  !insertmacro Record show
  ${If} $SimulatedDpi != ""
    System::Call 'user32::FindWindowW(w "OneKey.NativeInstaller", p 0) p.r2'
    System::Alloc 16
    Pop $3
    System::Call 'user32::GetWindowRect(p r2, p r3) i'
    IntOp $4 $SimulatedDpi << 16
    IntOp $4 $4 | $SimulatedDpi
    System::Call 'user32::SendMessageW(p r2, i 0x02E0, p r4, p r3) p'
    System::Free $3
    StrCpy $Result $SimulatedDpi
    !insertmacro Record dpi
  ${EndIf}
  ${Do}
    !insertmacro Call WaitForEvent ""
    !insertmacro Record event
    ${If} $Mode == "accessibility"
    ${AndIf} $Result == "browse-all"
      !insertmacro Call SetPerMachineInstallDirectory '"C:\Fixture\Changed"'
      !insertmacro Record directory
    ${EndIf}
    ${If} $Mode == "replay"
    ${AndIf} $Result == "primary-all"
    ${AndIf} $Retry == ""
      StrCpy $Retry "1"
      !insertmacro Call Hide ""
      !insertmacro Call Show ""
      !insertmacro Record unaccepted
      ${Continue}
    ${EndIf}
    ${If} $Result == "primary"
    ${OrIf} $Result == "primary-current"
    ${OrIf} $Result == "primary-all"
      ${Break}
    ${EndIf}
    ${If} $Result == "cancel"
    ${OrIf} $Result == "closed"
      !insertmacro Call ShutdownHidden ""
      FileClose $Log
      Quit
    ${EndIf}
  ${Loop}
  ${If} $Mode == "repeat-uninstall"
    !insertmacro Call SetPage '"uninstalling"'
  ${Else}
    !insertmacro Call SetPage '"installing"'
  ${EndIf}
  !insertmacro Record installing
  !insertmacro Call ResetProgress '"27"'
  !insertmacro Call Show ""
  Abort
FunctionEnd

Section
  !insertmacro Call SetProgress '"43"'
  !insertmacro Record worker-progress
  ${If} $Mode == "repeat-uninstall"
    Sleep 300
    !insertmacro Call SetPage '"uninstalling"'
    !insertmacro Record uninstalling-repeat
  ${EndIf}
  ${If} $Mode == "commit"
  ${OrIf} $Mode == "accessibility"
    Sleep 4000
  ${EndIf}
  ${Do}
    !insertmacro Call PrepareCommit ""
    !insertmacro Record prepare
    ${If} $Result == "pending"
      Sleep 170
    ${Else}
      ${Break}
    ${EndIf}
  ${Loop}
  ${If} $Result == "cancel"
    !insertmacro Call ShutdownHidden ""
    FileClose $Log
    SetErrorLevel 3
    Quit
  ${EndIf}
  !insertmacro Call SetProgress '"100"'
  !insertmacro Record complete
  Sleep 700
  Call ShowFinish
SectionEnd

Function ShowFinish
  !insertmacro Call SetPage '"finish"'
  !insertmacro Record finish-page
  !insertmacro Call Show ""
  !insertmacro Call WaitForEvent ""
  !insertmacro Record finish-event
  ${If} $Mode == "replay"
    !insertmacro Call SetPage '"finish"'
    !insertmacro Record finish-reset
    !insertmacro Call Show ""
    !insertmacro Record finish-reshow
    !insertmacro Call WaitForEvent ""
    !insertmacro Record finish-retry
  ${EndIf}
  !insertmacro Call ShutdownHidden ""
  FileClose $Log
  Quit
FunctionEnd
