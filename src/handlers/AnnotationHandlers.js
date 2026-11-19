const { ipcMain, globalShortcut } = require('electron')

// Only registered while a draw tool is active, never in cursor mode: these are plain
// editing keys, and holding them system-wide would break undo in whatever app is being
// demoed the moment the user goes back to interacting with it.
const DRAW_SHORTCUTS = {
  'CommandOrControl+Z': 'undo',
  Escape: 'cursor'
}

class AnnotationHandlers {
  constructor(app) {
    this.app = app
    this.setupHandlers()
  }

  setupHandlers() {
    ipcMain.handle('annotation:toggle', async () => {
      try {
        const overlay = this.app.windowManager.getWindow('annotationOverlay')
        if (overlay && !overlay.isDestroyed()) {
          this.closeAnnotation()
          return { success: true, open: false }
        }

        const targetDisplay = this.app.recordingManager.getTargetDisplay()
        const created = await this.app.windowManager.createAnnotationOverlayWindow(targetDisplay)
        // Stopping, discarding or restarting the recording tears these windows down by
        // another path; without this the shortcuts would stay grabbed system-wide.
        created.once('closed', () => this.unregisterDrawShortcuts())
        await this.app.windowManager.createAnnotationToolbarWindow(targetDisplay)
        this.sendToWindow(
          'annotationOverlay',
          'annotation:toolbar-rect',
          this.app.windowManager.getAnnotationToolbarRect()
        )
        return { success: true, open: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('annotation:close', () => {
      this.closeAnnotation()
      this.sendToWindow('floating', 'annotation:closed')
      return { success: true }
    })

    ipcMain.handle('annotation:set-tool', (event, tool) => {
      try {
        this.setTool(tool)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('annotation:set-color', (event, color) => {
      this.sendToWindow('annotationOverlay', 'annotation:color-changed', color)
      return { success: true }
    })

    ipcMain.handle('annotation:undo', () => {
      this.sendToWindow('annotationOverlay', 'annotation:undo')
      return { success: true }
    })

    ipcMain.handle('annotation:clear', () => {
      this.sendToWindow('annotationOverlay', 'annotation:clear')
      return { success: true }
    })
  }

  setTool(tool) {
    this.app.windowManager.setAnnotationInteractive(tool !== 'cursor')
    this.sendToWindow('annotationOverlay', 'annotation:tool-changed', tool)
    // The toolbar highlights the tool itself when the click comes from its own buttons;
    // this is for the ones a shortcut switched.
    this.sendToWindow('annotationToolbar', 'annotation:tool-changed', tool)

    if (tool === 'cursor') {
      this.unregisterDrawShortcuts()
    } else {
      this.registerDrawShortcuts()
    }
  }

  registerDrawShortcuts() {
    if (this._drawShortcutsOn) return
    this._drawShortcutsOn = true

    Object.entries(DRAW_SHORTCUTS).forEach(([accelerator, action]) => {
      try {
        globalShortcut.register(accelerator, () => {
          if (action === 'undo') {
            this.sendToWindow('annotationOverlay', 'annotation:undo')
          } else {
            this.setTool('cursor')
          }
        })
      } catch (e) {}
    })
  }

  unregisterDrawShortcuts() {
    if (!this._drawShortcutsOn) return
    this._drawShortcutsOn = false

    Object.keys(DRAW_SHORTCUTS).forEach(accelerator => {
      try {
        globalShortcut.unregister(accelerator)
      } catch (e) {}
    })
  }

  closeAnnotation() {
    this.unregisterDrawShortcuts()
    this.app.windowManager.closeAnnotationWindows()
  }

  sendToWindow(type, channel, payload) {
    const win = this.app.windowManager.getWindow(type)
    if (win && !win.isDestroyed()) {
      try {
        win.webContents.send(channel, payload)
      } catch (e) {}
    }
  }
}

module.exports = AnnotationHandlers
