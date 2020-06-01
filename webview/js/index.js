/* global acquireVsCodeApi, domtoimage */

(function PolacodeScript () {
  const vscode = acquireVsCodeApi()

  let target = 'container'

  const snippetNode = document.getElementById('snippet')
  const snippetTitleNode = document.getElementById('snippet-title')
  const snippetCodeNode = document.getElementById('snippet-code')
  const snippetContainerNode = document.getElementById('snippet-container')


  let state = {
    renderTitle: true,
    windowTitle: null,
    innerHTML: null,
  }

  const render = () => {
    snippetTitleNode.innerHTML = state.windowTitle && state.renderTitle ? `<span>${state.windowTitle}</span>` : ''

    if (state.innerHTML) {
      snippetCodeNode.innerHTML = state.innerHTML
    }
  }

  const setState = (partialState = {}) => {
    state = {
      ...state,
      ...partialState,
    }

    vscode.setState(state)

    render()
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

    doc.querySelectorAll('div > div span:first-child').forEach((node) => {
      // eslint-disable-next-line no-param-reassign
      node.textContent = node.textContent.slice(indent)
    })

    return doc.body.innerHTML
  }

  document.addEventListener('paste', (event) => {
    const innerHTML = event.clipboardData.getData('text/html')
    const code = event.clipboardData.getData('text/plain')
    const minIndent = getMinIndent(code)

    setState({ innerHTML: stripInitialIndent(innerHTML, minIndent) })
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

  snippetTitleNode.addEventListener('click', () => {
    setState({ renderTitle: !state.renderTitle })
  })

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
          state.windowTitle = event.data.windowTitle
          break

        case 'update':
          document.execCommand('paste')
          break

        case 'updateSettings':
          snippetNode.style.boxShadow = event.data.shadow
          snippetNode.style.fontVariantLigatures = event.data.ligature ? 'normal' : 'none'
          target = event.data.target
          state.windowTitle = event.data.windowTitle
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
    setState(oldState)
  }
}())
