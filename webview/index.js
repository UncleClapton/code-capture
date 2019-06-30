/* global acquireVsCodeApi, domtoimage, Vivus */
/* eslint-disable no-bitwise, no-magic-numbers */

const getRgba = (hex, transparentBackground) => {
  const bigint = parseInt(hex.slice(1), 16)
  const red = (bigint >> 16) & 255
  const green = (bigint >> 8) & 255
  const blue = bigint & 255
  const alpha = transparentBackground ? 0 : 1
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const activate = () => {
  const vscode = acquireVsCodeApi()

  let target = 'container'
  let transparentBackground = false
  let backgroundColor = '#f2f2f2'

  vscode.postMessage({
    type: 'getAndUpdateCacheAndSettings',
  })

  const snippetNode = document.getElementById('snippet')
  const snippetContainerNode = document.getElementById('snippet-container')
  const obturateur = document.getElementById('save')

  snippetContainerNode.style.opacity = '1'
  const oldState = vscode.getState()
  if (oldState && oldState.innerHTML) {
    snippetNode.innerHTML = oldState.innerHTML
  }

  const getInitialHtml = (fontFamily) => {
    const cameraWithFlashEmoji = String.fromCodePoint(128248)
    const monoFontStack = `${fontFamily},SFMono-Regular,Consolas,DejaVu Sans Mono,Ubuntu Mono,Liberation Mono,Menlo,Courier,monospace`
    // eslint-disable-next-line max-len
    return `<meta charset="utf-8"><div style="color: #d8dee9;background-color: #2e3440; font-family: ${monoFontStack};font-weight: normal;font-size: 12px;line-height: 18px;white-space: pre;"><div><span style="color: #8fbcbb;">console</span><span style="color: #eceff4;">.</span><span style="color: #88c0d0;">log</span><span style="color: #d8dee9;">(</span><span style="color: #eceff4;">'</span><span style="color: #a3be8c;">0. Run command \`Polacode ${cameraWithFlashEmoji}\`</span><span style="color: #eceff4;">'</span><span style="color: #d8dee9;">)</span></div><div><span style="color: #8fbcbb;">console</span><span style="color: #eceff4;">.</span><span style="color: #88c0d0;">log</span><span style="color: #d8dee9;">(</span><span style="color: #eceff4;">'</span><span style="color: #a3be8c;">1. Copy some code</span><span style="color: #eceff4;">'</span><span style="color: #d8dee9;">)</span></div><div><span style="color: #8fbcbb;">console</span><span style="color: #eceff4;">.</span><span style="color: #88c0d0;">log</span><span style="color: #d8dee9;">(</span><span style="color: #eceff4;">'</span><span style="color: #a3be8c;">2. Paste into Polacode view</span><span style="color: #eceff4;">'</span><span style="color: #d8dee9;">)</span></div><div><span style="color: #8fbcbb;">console</span><span style="color: #eceff4;">.</span><span style="color: #88c0d0;">log</span><span style="color: #d8dee9;">(</span><span style="color: #eceff4;">'</span><span style="color: #a3be8c;">3. Click the button ${cameraWithFlashEmoji}</span><span style="color: #eceff4;">'</span><span style="color: #d8dee9;">)</span></div></div></div>`
  }

  const serializeBlob = (blob, cb) => {
    const fileReader = new FileReader()

    fileReader.onload = () => {
      const bytes = new Uint8Array(fileReader.result)
      cb(Array.from(bytes).join(','))
    }

    fileReader.readAsArrayBuffer(blob)
  }

  const shoot = (serializedBlob) => {
    vscode.postMessage({
      type: 'shoot',
      data: {
        serializedBlob,
      },
    })
  }

  const getBrightness = (hexColor) => {
    const rgb = parseInt(hexColor.slice(1), 16)
    const red = (rgb >> 16) & 0xff
    const green = (rgb >> 8) & 0xff
    const blue = (rgb >> 0) & 0xff
    return (red * 299 + green * 587 + blue * 114) / 1000
  }

  const isDark = (hexColor) => getBrightness(hexColor) < 128

  const getSnippetBgColor = (html) => {
    const match = html.match(/background-color: (#[a-fA-F0-9]+)/u)
    return match ? match[1] : undefined
  }

  const updateEnvironment = (snippetBgColor) => {
    // update snippet bg color
    document.getElementById('snippet').style.backgroundColor = snippetBgColor

    // update backdrop color
    if (isDark(snippetBgColor)) {
      snippetContainerNode.style.backgroundColor = '#f2f2f2'
    } else {
      snippetContainerNode.style.background = 'none'
    }
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

    const snippetBgColor = getSnippetBgColor(innerHTML)
    if (snippetBgColor) {
      vscode.postMessage({
        type: 'updateBgColor',
        data: {
          bgColor: snippetBgColor,
        },
      })
      updateEnvironment(snippetBgColor)
    }

    snippetNode.innerHTML = stripInitialIndent(innerHTML, minIndent)
    vscode.setState({ innerHTML })
  })

  const shootAll = () => {
    const width = snippetContainerNode.offsetWidth * 2
    const height = snippetContainerNode.offsetHeight * 2
    const config = {
      width,
      height,
      style: {
        transform: 'scale(2)',
        'transform-origin': 'center',
        background: getRgba(backgroundColor, transparentBackground),
      },
    }

    // Hide resizer before capture
    snippetNode.style.resize = 'none'
    snippetContainerNode.style.resize = 'none'

    domtoimage.toBlob(snippetContainerNode, config).then((blob) => {
      snippetNode.style.resize = ''
      snippetContainerNode.style.resize = ''
      serializeBlob(blob, (serializedBlob) => {
        shoot(serializedBlob)
      })
    })
  }

  const shootSnippet = () => {
    const width = snippetNode.offsetWidth * 2
    const height = snippetNode.offsetHeight * 2
    const config = {
      width,
      height,
      style: {
        transform: 'scale(2)',
        'transform-origin': 'center',
        padding: 0,
        background: 'none',
      },
    }

    // Hide resizer before capture
    snippetNode.style.resize = 'none'
    snippetContainerNode.style.resize = 'none'

    domtoimage.toBlob(snippetContainerNode, config).then((blob) => {
      snippetNode.style.resize = ''
      snippetContainerNode.style.resize = ''
      serializeBlob(blob, (serializedBlob) => {
        shoot(serializedBlob)
      })
    })
  }

  let aniTimout = null
  const buttonVivus = new Vivus('save', {
    duration: 40,
    onReady: () => {
      aniTimout = setTimeout(() => {
        obturateur.classList.remove('filling')
      }, 700)
    },
  })

  obturateur.addEventListener('click', () => {
    if (target === 'container') {
      shootAll()
    } else {
      shootSnippet()
    }

    clearTimeout(aniTimout)
    obturateur.classList.add('filling')
    buttonVivus
      .stop()
      .reset()
      .play(() => {
        aniTimout = setTimeout(() => {
          obturateur.classList.remove('filling')
        }, 700)
      })
  })

  window.addEventListener('message', (event) => {
    if (event) {
      switch (event.data.type) {
        case 'init':
          if (isDark(event.data.bgColor)) {
            snippetContainerNode.style.backgroundColor = '#f2f2f2'
          } else {
            snippetContainerNode.style.background = 'none'
          }
          break

        case 'setInitialHtml':
          // eslint-disable-next-line no-case-declarations
          const initialHtml = getInitialHtml(event.data.fontFamily)
          snippetNode.innerHTML = initialHtml
          vscode.setState({ innerHTML: initialHtml })
          break

        case 'update':
          document.execCommand('paste')
          break

        case 'restore':
          snippetNode.innerHTML = event.data.innerHTML
          updateEnvironment(event.data.bgColor)
          break

        case 'restoreBgColor':
          updateEnvironment(event.data.bgColor)
          break

        case 'updateSettings':
          snippetNode.style.boxShadow = event.data.shadow
          target = event.data.target
          transparentBackground = event.data.transparentBackground
          snippetContainerNode.style.backgroundColor = event.data.backgroundColor
          backgroundColor = event.data.backgroundColor
          if (event.data.ligature) {
            snippetNode.style.fontVariantLigatures = 'normal'
          } else {
            snippetNode.style.fontVariantLigatures = 'none'
          }
          break

        default:
          break
      }
    }
  })
}

activate()
