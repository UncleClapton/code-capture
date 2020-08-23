param($path)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile($path))