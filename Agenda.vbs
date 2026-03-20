Set oShell = CreateObject("WScript.Shell")
pasta = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
oShell.Run "cmd /c cd /d """ & pasta & """ && npx electron .", 0, False