const vscode = require('vscode') /* eslint-disable-line import/no-unresolved */// this is fine
const fs = require('fs')
const path = require('path')
const { homedir } = require('os')

const writeSerializedBlobToFile = (serializeBlob, fileName) => {
  const bytes = new Uint8Array(serializeBlob.split(','))
  fs.writeFileSync(fileName, Buffer.from(bytes))
}

const WEBVIEW_TITLE = 'Polacode'



const getHtmlContent = (htmlPath) => {
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8')
  return htmlContent.replace(/script src="([^"]*)"/gu, (match, src) => {
    const realSource = `vscode-resource:${path.resolve(htmlPath, '..', src)}`
    return `script src="${realSource}"`
  })
}

const getTimestamp = () => Math.trunc((new Date()).getTime() / 1000)





/**
 * @param {vscode.ExtensionContext} context
 */
const activate = (context) => {
  const htmlPath = path.resolve(context.extensionPath, 'webview', 'index.html')

  let lastUsedImagePath = null
  let panel = null


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
      const timeoutTime = vscode.workspace.getConfiguration('polacode').get('closeOnSaveDelay')
      setTimeout(() => {
        panel.dispose()
      // eslint-disable-next-line no-magic-numbers
      }, timeoutTime)
    }
  }

  const copyToClipboard = () => {
    let filePath = getFileSavePath()
    switch(process.platform) {
      case 'darwin':
        const { exec } = require('child_process');
        exec(`${path.join(__dirname, '../res/mac-to-clip')} ${filePath}`, (err) => {
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
          saveFile(data.serializedBlob)
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

        default:
          break
      }
    })
  }

  const setupSelectionSync = () => vscode.window.onDidChangeTextEditorSelection((event) => {
    if (event.selections[0] && !event.selections[0].isEmpty) {
      copySelection()
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
    panel = vscode.window.createWebviewPanel('polacode', WEBVIEW_TITLE, 2, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'webview'))],
    })
    panel.webview.html = getHtmlContent(htmlPath)

    setupMessageListeners()

    const selectionListener = setupSelectionSync()
    panel.onDidDispose(() => {
      selectionListener.dispose()
    })

    const bgColor = context.globalState.get('polacode.bgColor', '#2e3440')
    panel.webview.postMessage({
      type: 'init',
      bgColor,
    })

    const { fontFamily } = vscode.workspace.getConfiguration('editor')
    const { selection } = vscode.window.activeTextEditor
    if (selection && !selection.isEmpty) {
      copySelection()
    } else {
      panel.webview.postMessage({
        type: 'setInitialHtml',
        fontFamily,
      })
    }

    syncSettings()
  })

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('polacode') || event.affectsConfiguration('editor')) {
      syncSettings()
    }

    if (event.affectsConfiguration('polacode.defaultPath')) {
      lastUsedImagePath = null
    }
  })
}

exports.activate = activate
