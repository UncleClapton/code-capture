const vscode = require('vscode') /* eslint-disable-line import/no-unresolved */// this is fine
const fs = require('fs')
const path = require('path')
const { homedir } = require('os')

const writeSerializedBlobToFile = (serializeBlob, fileName) => {
  const bytes = new Uint8Array(serializeBlob.split(','))
  fs.writeFileSync(fileName, Buffer.from(bytes))
}

const P_TITLE = 'Polacode 📸'



const getHtmlContent = (htmlPath) => {
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8')
  return htmlContent.replace(/script src="([^"]*)"/gu, (match, src) => {
    const realSource = `vscode-resource:${path.resolve(htmlPath, '..', src)}`
    return `script src="${realSource}"`
  })
}





/**
 * @param {vscode.ExtensionContext} context
 */
const activate = (context) => {
  const htmlPath = path.resolve(context.extensionPath, 'webview/index.html')

  let lastUsedImageUri = vscode.Uri.file(path.resolve(homedir(), 'Desktop/code.png'))
  let panel = null





  const syncSettings = () => {
    const settings = vscode.workspace.getConfiguration('polacode')
    const editorSettings = vscode.workspace.getConfiguration('editor', null)
    panel.webview.postMessage({
      type: 'updateSettings',
      shadow: settings.get('shadow'),
      transparentBackground: settings.get('transparentBackground'),
      backgroundColor: settings.get('backgroundColor'),
      target: settings.get('target'),
      ligature: editorSettings.get('fontLigatures'),
    })
  }

  const setupMessageListeners = () => {
    panel.webview.onDidReceiveMessage(({ type, data }) => {
      switch (type) {
        case 'shoot':
          vscode.window
            .showSaveDialog({
              defaultUri: lastUsedImageUri,
              filters: {
                Images: ['png'],
              },
            })
            .then((uri) => {
              if (uri) {
                writeSerializedBlobToFile(data.serializedBlob, uri.fsPath)
                lastUsedImageUri = uri
              }
            })
          break

        case 'getAndUpdateCacheAndSettings':
          panel.webview.postMessage({
            type: 'restoreBgColor',
            bgColor: context.globalState.get('polacode.bgColor', '#2e3440'),
          })

          syncSettings()
          break

        case 'updateBgColor':
          context.globalState.update('polacode.bgColor', data.bgColor)
          break

        case 'invalidPasteContent':
          vscode.window.showInformationMessage(
            'Pasted content is invalid. Only copy from VS Code and check if your shortcuts for copy/paste have conflicts.'
          )
          break

        default:
          break
      }
    })
  }

  const setupSelectionSync = () => vscode.window.onDidChangeTextEditorSelection((event) => {
    if (event.selections[0] && !event.selections[0].isEmpty) {
      vscode.commands.executeCommand('editor.action.clipboardCopyAction')
      panel.postMessage({
        type: 'update',
      })
    }
  })





  vscode.window.registerWebviewPanelSerializer('polacode', {
    deserializeWebviewPanel: (_panel, state) => {
      panel = _panel
      panel.webview.html = getHtmlContent(htmlPath)
      panel.webview.postMessage({
        type: 'restore',
        innerHTML: state.innerHTML,
        bgColor: context.globalState.get('polacode.bgColor', '#2e3440'),
      })
      const selectionListener = setupSelectionSync()
      panel.onDidDispose(() => {
        selectionListener.dispose()
      })
      setupMessageListeners()
    },
  })

  vscode.commands.registerCommand('polacode.activate', () => {
    panel = vscode.window.createWebviewPanel('polacode', P_TITLE, 2, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'webview'))],
    })

    panel.webview.html = getHtmlContent(htmlPath)

    const selectionListener = setupSelectionSync()
    panel.onDidDispose(() => {
      selectionListener.dispose()
    })

    setupMessageListeners()

    const { fontFamily } = vscode.workspace.getConfiguration('editor')
    const bgColor = context.globalState.get('polacode.bgColor', '#2e3440')
    panel.webview.postMessage({
      type: 'init',
      fontFamily,
      bgColor,
    })

    syncSettings()
  })

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('polacode') || event.affectsConfiguration('editor')) {
      syncSettings()
    }
  })
}

exports.activate = activate
