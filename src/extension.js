const { homedir } = require('os')
const path = require('path')
const vscode = require('vscode') /* eslint-disable-line import/no-unresolved */// this is fine





const {
  getTimestamp,
  getWebviewContent,
  getWindowTitle,
  writeSerializedBlobToFile,
} = require('./util')





const WEBVIEW_TITLE = 'Polacode'





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

    if (vscode.workspace.getConfiguration('polacode').get('closeOnSave')) {
      const timeoutTime = vscode.workspace.getConfiguration('polacode').get('closeOnSaveDelay')
      setTimeout(() => {
        panel.dispose()
      }, timeoutTime)
    }
  }



  const copySelection = () => {
    const editor = vscode.window.activeTextEditor

    if (editor && editor.selection && !editor.selection.isEmpty) {
      const settings = vscode.workspace.getConfiguration('polacode')

      vscode.commands.executeCommand('editor.action.clipboardCopyWithSyntaxHighlightingAction')

      panel.postMessage({
        type: 'update',
        windowTitle: settings.get('windowTitle') ? getWindowTitle() : null,
      })
    }
  }

  const syncSettings = () => {
    const settings = vscode.workspace.getConfiguration('polacode')
    const editorSettings = vscode.workspace.getConfiguration('editor', null)
    panel.webview.postMessage({
      type: 'updateSettings',
      shadow: settings.get('shadow'),
      target: settings.get('target'),
      ligature: editorSettings.get('fontLigatures'),
    })
  }

  const setupPanel = (_panel) => {
    panel = _panel
    panel.webview.html = getWebviewContent(htmlPath, panel)

    vscode.window.onDidChangeActiveColorTheme(() => {
      copySelection()
    }, null, disposables)

    vscode.window.onDidChangeTextEditorSelection(() => {
      copySelection()
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

  vscode.window.registerWebviewPanelSerializer('polacode', {
    deserializeWebviewPanel: (_panel) => {
      setupPanel(_panel)
    },
  })

  vscode.commands.registerCommand('polacode.activate', () => {
    if (panel) {
      panel.reveal(vscode.ViewColumn.Two, true)
    } else {
      setupPanel(
        vscode.window.createWebviewPanel('polacode', WEBVIEW_TITLE, {
          preserveFocus: true,
          viewColumn: vscode.ViewColumn.Two,
        }, {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.file(context.extensionPath)],
        }),
      )
    }

    syncSettings()
    copySelection()
  })
}
