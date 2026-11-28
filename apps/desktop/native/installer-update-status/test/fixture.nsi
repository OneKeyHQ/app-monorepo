Unicode true
RequestExecutionLevel user
Name "OneKey update status fixture"
OutFile "${FIXTURE_OUTPUT}"
AutoCloseWindow true

!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "${FIXTURE_FLAGS}"
!include "..\update-status.nsh"

Page instfiles

Section
  ${GetParameters} $1
  ${GetOptions} $1 "/blockhost" $0
  ${IfNot} ${Errors}
    # ProcessChildProcessPolicy with NoChildProcessCreation.
    System::Call "kernel32::SetProcessMitigationPolicy(i 13, *i 1, p 4) i .r0"
    ${If} $0 != 1
      SetErrorLevel 92
      Quit
    ${EndIf}
  ${EndIf}
  ${GetOptions} $1 "/locale=" $2
  StrCpy $0 "register sentinel"
  StrCpy $R9 "flag register sentinel"
  Push "stack sentinel"
  SetErrors
  !insertmacro OneKeyStartUpdateStatus "$2"
  ${IfNot} ${Errors}
    SetErrorLevel 90
    Quit
  ${EndIf}
  Pop $3
  ${If} $0 != "register sentinel"
  ${OrIf} $R9 != "flag register sentinel"
  ${OrIf} $3 != "stack sentinel"
    SetErrorLevel 91
    Quit
  ${EndIf}

  FileOpen $0 "$EXEDIR\plugins-path.txt" w
  FileWrite $0 "$PLUGINSDIR"
  FileClose $0
  Sleep 2500
  ${GetOptions} $1 "/hold" $0
  ${IfNot} ${Errors}
    Sleep 15000
  ${EndIf}
  ${GetOptions} $1 "/fail" $0
  ${IfNot} ${Errors}
    Abort "Fixture installation failed."
  ${EndIf}
SectionEnd
