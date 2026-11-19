const toolButtons = {
  cursor: document.getElementById('toolCursor'),
  pen: document.getElementById('toolPen'),
  rect: document.getElementById('toolRect'),
  circle: document.getElementById('toolCircle'),
  arrow: document.getElementById('toolArrow')
}

function highlightTool(tool) {
  Object.entries(toolButtons).forEach(([name, btn]) => {
    btn.classList.toggle('active', name === tool)
  })
}

function selectTool(tool) {
  highlightTool(tool)
  window.electronAPI.setAnnotationTool(tool)
}

Object.entries(toolButtons).forEach(([name, btn]) => {
  btn.addEventListener('click', () => selectTool(name))
})

// A shortcut can switch the tool without going through these buttons. Only repaint the
// highlight here — calling selectTool would echo the change straight back to the main
// process that just sent it.
window.electronAPI.onAnnotationToolChanged && window.electronAPI.onAnnotationToolChanged(highlightTool)

document.querySelectorAll('.swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'))
    swatch.classList.add('active')
    window.electronAPI.setAnnotationColor(swatch.dataset.color)
  })
})

document.getElementById('undoBtn').addEventListener('click', () => {
  window.electronAPI.undoAnnotation()
})

document.getElementById('clearBtn').addEventListener('click', () => {
  window.electronAPI.clearAnnotation()
})

document.getElementById('closeBtn').addEventListener('click', () => {
  window.electronAPI.closeAnnotation()
})

selectTool('pen')
