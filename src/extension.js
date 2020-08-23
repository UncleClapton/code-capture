const { homedir } = require('os')
const path = require('path')
const vscode = require('vscode') /* eslint-disable-line import/no-unresolved */// this is fine
const { exec } = require('child_process') 





const {
  getTimestamp,
  getWebviewContent,
  getWindowTitle,
  writeSerializedBlobToFile,
} = require('./util')




const CLOSE_ON_SAVE_DELAY = 1250
const WEBVIEW_NAME = 'polacode'
const WEBVIEW_TITLE = 'Capture'





/**
 * @param {vscode.ExtensionContext} context
 */
exports.activate = (context) => {
  const htmlPath = path.resolve(context.extensionPath, 'webview', 'index.html')

  let lastUsedImagePath = null
  let panel = null
  const disposables = []


  const getFileSavePath = () => {
    const filePath = lastUsedImagePath || vscode.workspace.getConfiguration('polacode').get('defaultPath') || path.resolve(homedir(), 'Desktop')
    return path.resolve(filePath, `polacode-${getTimestamp()}.png`)
  }

  const saveFile = async (serializedBlob) => {
    let saveFilePath = getFileSavePath()

    if (!vscode.workspace.getConfiguration('polacode').get('autoSave')) {
      const fileURI = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(saveFilePath),
        filters: {
          Images: ['png'],
        },
      })

      saveFilePath = fileURI.fsPath
    }

    if (saveFilePath) {
      writeSerializedBlobToFile(serializedBlob, saveFilePath)
      lastUsedImagePath = path.parse(saveFilePath).dir
    }
    if (vscode.workspace.getConfiguration('polacode').get('saveToClipboard'))
      copyToClipboard()

    if (vscode.workspace.getConfiguration('polacode').get('closeOnSave')) {
      setTimeout(() => {
        panel.dispose()
      }, CLOSE_ON_SAVE_DELAY)
    }
  }

  const copyToClipboard = () => {
    let filePath = getFileSavePath()
    switch(process.platform) {
      case 'linux':
        exec(`xclip -sel clip -t image/png -i ${filePath}`, (err) => {
          if (err) {
            vscode.window.showErrorMessage('Could not copy to clipboard! ' + err.message)
            return
          }
        })
        break

      case 'darwin':
        exec(`${path.join(__dirname, '../res/mac-to-clip')} ${filePath}`, (err) => {
          if (err) {
            vscode.window.showErrorMessage('Could not copy to clipboard! ' + err.message)
            return
          }
        })
        break
      case 'win32':
        let ps_args = '-noprofile -noninteractive -nologo -sta -windowstyle hidden -executionpolicy unrestricted -file'
        exec(`powershell ${ps_args} ${path.join(__dirname, '../res/win-to-clip.ps1')} -path ${filePath}`, (err) => {
          if (err) {
            vscode.window.showErrorMessage('Could not copy to clipboard! ' + err.message)
            return
          }
        })
        break
      default:
        vscode.window.showErrorMessage(`Saving to clipboard not supported on this platform.${filePath? ' Image saved to ' + filePath:''}`)
    }
  }

  const copySelection = () => {
    vscode.commands.executeCommand('editor.action.clipboardCopyAction')
    panel.postMessage({
      type: 'update',
    })
  }


  const updateSnippet = () => {
    const editor = vscode.window.activeTextEditor

    if (editor && editor.selection && !editor.selection.isEmpty) {
      vscode.commands.executeCommand('editor.action.clipboardCopyWithSyntaxHighlightingAction')

      panel.postMessage({
        type: 'updateSnippet',
        windowTitle: getWindowTitle(),
      })
    }
  }

  const syncSettings = () => {
    const settings = vscode.workspace.getConfiguration('polacode')
    const editorSettings = vscode.workspace.getConfiguration('editor', null)
    panel.webview.postMessage({
      type: 'updateSettings',
      background: settings.get('background'),
      shadow: settings.get('shadow'),
      padding: settings.get('padding'),
      renderTitle: settings.get('windowTitle'),
      scale: settings.get('captureScale'),
      target: settings.get('target'),
      ligature: editorSettings.get('fontLigatures'),
    })
  }

  const getNewPanel = () => {
    return vscode.window.createWebviewPanel(WEBVIEW_NAME, WEBVIEW_TITLE, {
      preserveFocus: true,
      viewColumn: vscode.ViewColumn.Two,
    }, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(context.extensionPath)],
    })
  }

  const setupPanel = (_panel = getNewPanel()) => {
    panel = _panel
    panel.webview.html = getWebviewContent(panel, htmlPath)
    panel.iconPath = vscode.Uri.file(path.resolve(context.extensionPath, 'icon.png'))

    vscode.window.onDidChangeActiveColorTheme(() => {
      updateSnippet()
    }, null, disposables)

    vscode.window.onDidChangeTextEditorSelection(() => {
      updateSnippet()
    }, null, disposables)

    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('polacode') || event.affectsConfiguration('editor')) {
        syncSettings()
      }

      if (event.affectsConfiguration('polacode.defaultPath')) {
        lastUsedImagePath = null
      }
    }, null, disposables)

    panel.webview.onDidReceiveMessage(({ type, data }) => {
      switch (type) {
        case 'shoot':
          saveFile(data.serializedBlob)
          break

        case 'getAndUpdateCacheAndSettings':
          syncSettings()
          break

        default:
          break
      }
    }, null, disposables)

    panel.onDidDispose(() => {
      panel.dispose()

      while (disposables.length) {
        const listener = disposables.pop()
        if (listener) {
          listener.dispose()
        }
      }

      panel = null
    }, null, disposables)
  }

  vscode.window.registerWebviewPanelSerializer(WEBVIEW_NAME, {
    deserializeWebviewPanel: (_panel) => {
      setupPanel(_panel)
      syncSettings()
    },
  })

  vscode.commands.registerCommand('polacode.activate', () => {
    if (panel) {
      try {
        panel.reveal(vscode.ViewColumn.Two, true)
      } catch {
        setupPanel()
      }
    } else {
      setupPanel()
    }

    syncSettings()
    updateSnippet()
  })
}
