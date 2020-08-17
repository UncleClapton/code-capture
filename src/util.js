const fs = require('fs')
const path = require('path')
const vscode = require('vscode') /* eslint-disable-line import/no-unresolved */// this is fine





const NONCE_LENGTH = 32

const getNonce = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let text = ''
  // eslint-disable-next-line no-restricted-syntax
  for (let char = 0; char < NONCE_LENGTH; char += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}





const getWebviewContent = (panel, htmlPath) => {
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


const writeSerializedBlobToFile = (serializeBlob, fileName) => {
  const bytes = new Uint8Array(serializeBlob.split(','))
  fs.writeFileSync(fileName, Buffer.from(bytes))
}

const getTimestamp = () => {
  return Math.trunc((new Date()).getTime() / 1000)
}


module.exports = {
  getTimestamp,
  getWebviewContent,
  getWindowTitle,
  writeSerializedBlobToFile,
}
