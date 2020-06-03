const { homedir } = require('os')
const path = require('path')
const vscode = require('vscode') /* eslint-disable-line import/no-unresolved */// this is fine





const {
  getTimestamp,
  getWebviewContent,
  getWindowTitle,
  writeSerializedBlobToFile,
} = require('./util')





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
    const filePath = lastUsedImagePath || vscode.workspace.getConfiguration('codeCapture').get('defaultPath') || path.resolve(homedir(), 'Desktop')
    return path.resolve(filePath, `VSCode-Screenshot-${getTimestamp()}.png`)
  }

  const saveFile = async (serializedBlob) => {
    let saveFilePath = getFileSavePath()

    if (!vscode.workspace.getConfiguration('codeCapture').get('autoSave')) {
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

    if (vscode.workspace.getConfiguration('codeCapture').get('closeOnSave')) {
      const timeoutTime = vscode.workspace.getConfiguration('codeCapture').get('closeOnSaveDelay')
      setTimeout(() => {
        panel.dispose()
      }, timeoutTime)
    }
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
    const settings = vscode.workspace.getConfiguration('codeCapture')
    const editorSettings = vscode.workspace.getConfiguration('editor', null)
    panel.webview.postMessage({
      type: 'updateSettings',
      background: settings.get('background'),
      shadow: settings.get('shadow'),
      padding: settings.get('padding'),
      renderTitle: settings.get('windowTitle'),
      target: settings.get('target'),
      ligature: editorSettings.get('fontLigatures'),
    })
  }

  const getNewPanel = () => {
    return vscode.window.createWebviewPanel('codeCapture', WEBVIEW_TITLE, {
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
      if (event.affectsConfiguration('codeCapture') || event.affectsConfiguration('editor')) {
        syncSettings()
      }

      if (event.affectsConfiguration('codeCapture.defaultPath')) {
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

  vscode.window.registerWebviewPanelSerializer('codeCapture', {
    deserializeWebviewPanel: (_panel) => {
      setupPanel(_panel)
      syncSettings()
    },
  })

  vscode.commands.registerCommand('codeCapture.activate', () => {
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
