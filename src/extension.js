const fs = require('fs')
const { homedir } = require('os')
const path = require('path')
const vscode = require('vscode') /* eslint-disable-line import/no-unresolved */// this is fine





const LOAD_DELAY = 200
const NONCE_LENGTH = 32
const WEBVIEW_TITLE = 'Polacode'





const writeSerializedBlobToFile = (serializeBlob, fileName) => {
  const bytes = new Uint8Array(serializeBlob.split(','))
  fs.writeFileSync(fileName, Buffer.from(bytes))
}

const getNonce = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let text = ''
  // eslint-disable-next-line no-restricted-syntax
  for (let char = 0; char < NONCE_LENGTH; char += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

const getHtmlContent = (htmlPath, panel) => {
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8')

  const nonce = getNonce()

  return htmlContent
    .replace(/%VSC_CSP%/gu, panel.webview.cspSource)
    .replace(/%VSC_NONCE%/gu, nonce)
    .replace(/src="([^"]*)"/gu, (match, src) => {
      return `src="${
        panel.webview.asWebviewUri(vscode.Uri.file(path.resolve(htmlPath, '..', src)))
      }"`
    })
}

const getTimestamp = () => {
  return Math.trunc((new Date()).getTime() / 1000)
}





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
      vscode.commands.executeCommand('editor.action.clipboardCopyWithSyntaxHighlightingAction')
      panel.postMessage({
        type: 'update',
      })
    }
  }

  const getWindowTitle = () => {
    const titleParts = []

    const editor = vscode.window.activeTextEditor

    if (editor) {
      const filePath = editor.document.fileName.split('/')
      let fileName = filePath.pop()

      // Include parent if file is an index file.
      if (fileName.split('.')[0].toLowerCase() === 'index') {
        fileName = `${filePath.pop()}/${fileName}`
      }

      titleParts.push(fileName)
    }

    if (vscode.workspace.name) {
      // Hide vscode-remote tags
      titleParts.push(vscode.workspace.name.replace(/\s\[[^\[\]]+\]$/gu, ''))
    }

    const editorConfig = vscode.workspace.getConfiguration('window')
    const separator = editorConfig.get('titleSeparator', ' - ')

    // eslint-disable-next-line arrow-body-style
    return titleParts.filter((part) => part).join(separator)
  }

  const syncWindowTitle = () => {
    if (vscode.workspace.getConfiguration('polacode').get('windowTitle')) {
      panel.webview.postMessage({
        type: 'updateTitleState',
        windowTitle: getWindowTitle(),
      })
    }
  }

  const syncSettings = () => {
    const settings = vscode.workspace.getConfiguration('polacode')
    const editorSettings = vscode.workspace.getConfiguration('editor', null)
    panel.webview.postMessage({
      type: 'updateSettings',
      shadow: settings.get('shadow'),
      windowTitle: settings.get('windowTitle') ? getWindowTitle() : null,
      target: settings.get('target'),
      ligature: editorSettings.get('fontLigatures'),
    })
  }

  const setupPanel = (_panel) => {
    panel = _panel
    panel.webview.html = getHtmlContent(htmlPath, panel)

    vscode.window.onDidChangeActiveColorTheme(() => {
      copySelection()
    }, null, disposables)

    vscode.window.onDidChangeActiveTextEditor(() => {
      syncWindowTitle()
    }, null, disposables)

    vscode.window.onDidChangeTextEditorSelection(() => {
      copySelection()
    }, null, disposables)

    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('polacode') || event.affectsConfiguration('editor') || event.affectsConfiguration('window.titleSeparator')) {
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
      panel.reveal(vscode.ViewColumn.Two)
      return
    }

    setupPanel(
      vscode.window.createWebviewPanel('polacode', WEBVIEW_TITLE, vscode.ViewColumn.Two, {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(context.extensionPath)],
      }),
    )

    syncSettings()

    setTimeout(copySelection, LOAD_DELAY)
  })
}
