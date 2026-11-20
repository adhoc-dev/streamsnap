const { BrowserWindow, screen } = require('electron')

// Distinct, saturated colors: easy to tell apart in a captured frame.
const PROBE_COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff']

/**
 * Identifies which monitor a capture stream is really showing when its resolution is
 * not enough (two monitors with the same size). It paints a solid, different color on
 * every candidate display for a moment; the renderer then looks at the captured frame
 * and tells which color it contains. That is evidence from the recorded pixels, so it
 * does not depend on desktopCapturer's display_id numbering or source ordering.
 */
class DisplayProbe {
  constructor() {
    this.windows = []
  }

  // Candidates are the displays whose physical size matches the captured one.
  findCandidates(capturedWidth, capturedHeight) {
    return screen.getAllDisplays().filter(display => {
      const scale = display.scaleFactor || 1
      const size = display.size || display.bounds || {}
      return (
        Math.abs(Math.round(size.width * scale) - capturedWidth) <= 2 &&
        Math.abs(Math.round(size.height * scale) - capturedHeight) <= 2
      )
    })
  }

  // Paints the candidates and returns [{ displayId, color }]. Nothing is painted (and
  // [] comes back) when the size already points at a single display.
  async show(capturedWidth, capturedHeight) {
    this.hide()
    if (!(capturedWidth > 0 && capturedHeight > 0)) return []

    const candidates = this.findCandidates(capturedWidth, capturedHeight).slice(0, PROBE_COLORS.length)
    if (candidates.length < 2) return []

    const shown = await Promise.all(candidates.map((display, index) => this.paint(display, PROBE_COLORS[index])))
    // Give the compositor a moment so the next captured frames contain the color.
    await new Promise(resolve => setTimeout(resolve, 250))

    return candidates.map((display, index) => ({
      displayId: String(display.id),
      color: PROBE_COLORS[index],
      shown: shown[index]
    }))
  }

  paint(display, color) {
    return new Promise(resolve => {
      try {
        const { x, y, width, height } = display.bounds
        const win = new BrowserWindow({
          x,
          y,
          width,
          height,
          frame: false,
          show: false,
          focusable: false,
          skipTaskbar: true,
          resizable: false,
          hasShadow: false,
          alwaysOnTop: true,
          backgroundColor: color
        })
        win.setAlwaysOnTop(true, 'screen-saver')
        this.windows.push(win)
        win.once('ready-to-show', () => {
          if (!win.isDestroyed()) win.showInactive()
          resolve(true)
        })
        win.loadURL('data:text/html,' + encodeURIComponent(`<body style="margin:0;background:${color}"></body>`))
        setTimeout(() => resolve(false), 2000)
      } catch (e) {
        resolve(false)
      }
    })
  }

  hide() {
    this.windows.forEach(win => {
      try {
        if (!win.isDestroyed()) win.destroy()
      } catch (e) {}
    })
    this.windows = []
  }
}

module.exports = DisplayProbe
