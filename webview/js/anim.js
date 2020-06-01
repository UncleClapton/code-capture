/* global Vivus */

(function ObturateurAnimation () {
  const ANIM_DELAY = 700
  const obturateur = document.getElementById('save')

  let aniTimout = null
  const buttonVivus = new Vivus('save', {
    duration: 40,
    onReady: () => {
      aniTimout = setTimeout(() => {
        obturateur.classList.remove('filling')
      }, ANIM_DELAY)
    },
  })

  obturateur.addEventListener('click', () => {
    clearTimeout(aniTimout)
    obturateur.classList.add('filling')
    buttonVivus
      .stop()
      .reset()
      .play(() => {
        aniTimout = setTimeout(() => {
          obturateur.classList.remove('filling')
        }, ANIM_DELAY)
      })
  })
}())
