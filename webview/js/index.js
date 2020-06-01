/* global acquireVsCodeApi, domtoimage, Vivus */
/* eslint-disable no-bitwise, no-magic-numbers */

(function () {
  const vscode = acquireVsCodeApi()

  let target = 'container'
  let windowTitle = null

  const snippetNode = document.getElementById('snippet')
  const snippetTitleNode = document.getElementById('snippet-title')
  const snippetCodeNode = document.getElementById('snippet-code')
  const snippetContainerNode = document.getElementById('snippet-container')





  const updateTitle = () => {
    snippetTitleNode.innerHTML = windowTitle ? `<span>${windowTitle}</span>` : ''
  }

  const getMinIndent = (code) => {
    const arr = code.split('\n')

    let minIndentCount = Number.MAX_VALUE

    arr.forEach((line) => {
      const wsCount = line.search(/\S/u)
      if (wsCount !== -1) {
        if (wsCount < minIndentCount) {
          minIndentCount = wsCount
        }
      }
    })

    return minIndentCount
  }

  const stripInitialIndent = (html, indent) => {
    if (indent === 0) {
      return html
    }

    const doc = new DOMParser().parseFromString(html, 'text/html')

    const initialSpans = doc.querySelectorAll('div > div span:first-child')


    for (let index = 0; index < initialSpans.length; index += 1) {
      initialSpans[index].textContent = initialSpans[index].textContent.slice(indent)
    }

    return doc.body.innerHTML
  }

  document.addEventListener('paste', (event) => {
    const innerHTML = event.clipboardData.getData('text/html')
    const code = event.clipboardData.getData('text/plain')
    const minIndent = getMinIndent(code)

    updateTitle()
    snippetCodeNode.innerHTML = stripInitialIndent(innerHTML, minIndent)

    vscode.setState({ windowTitle, innerHTML })
  })





  const serializeBlob = (blob) => {
    return new Promise((resolve) => {
      const fileReader = new FileReader()

      fileReader.onload = () => {
        const bytes = new Uint8Array(fileReader.result)
        resolve(Array.from(bytes).join(','))
      }

      fileReader.readAsArrayBuffer(blob)
    })
  }

  const shoot = async (config) => {
    snippetNode.style.resize = 'none'

    const blob = await domtoimage.toBlob(snippetContainerNode, config)

    snippetNode.style.resize = ''

    const serializedBlob = await serializeBlob(blob)

    vscode.postMessage({
      type: 'shoot',
      data: {
        serializedBlob,
      },
    })
  }

  const shootAll = () => {
    shoot({
      width: snippetContainerNode.offsetWidth * 2,
      height: snippetContainerNode.offsetHeight * 2,
      style: {
        transform: 'scale(2)',
        'transform-origin': 'center',
        background: 'none',
      },
    })
  }

  const shootSnippet = () => {
    shoot({
      width: snippetNode.offsetWidth * 2,
      height: snippetNode.offsetHeight * 2,
      style: {
        transform: 'scale(2)',
        'transform-origin': 'center',
        padding: 0,
        background: 'none',
      },
    })
  }

  document.getElementById('save').addEventListener('click', () => {
    if (target === 'container') {
      shootAll()
    } else {
      shootSnippet()
    }
  })

  window.addEventListener('message', (event) => {
    if (event) {
      switch (event.data.type) {
        case 'updateTitleState':
          windowTitle = event.data.windowTitle
          vscode.setState({ windowTitle })
          break

        case 'update':
          document.execCommand('paste')
          break

        case 'restore':
          windowTitle = event.data.windowTitle
          updateTitle()
          snippetCodeNode.innerHTML = event.data.innerHTML
          break

        case 'updateSettings':
          snippetNode.style.boxShadow = event.data.shadow
          snippetNode.style.fontVariantLigatures = event.data.ligature ? 'normal' : 'none'
          target = event.data.target
          windowTitle = event.data.windowTitle
          vscode.setState({ windowTitle })
          break

        default:
          break
      }
    }
  })

  vscode.postMessage({
    type: 'getAndUpdateCacheAndSettings',
  })

  snippetContainerNode.style.opacity = '1'

  const oldState = vscode.getState()
  if (oldState) {
    if (oldState.innerHTML) {
      snippetCodeNode.innerHTML = oldState.innerHTML
    }
    if (oldState.windowTitle) {
      windowTitle = oldState.windowTitle
      updateTitle()
    }
  }
}())
