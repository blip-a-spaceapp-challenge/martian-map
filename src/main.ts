import { app, BrowserWindow } from 'electron/main'
import * as path from 'node:path'

const createWindow = (): void => {
  const win = new BrowserWindow({ width: 800, height: 600 })
  win.loadFile(path.join(__dirname, '../public/index.html'))
}

app.whenReady().then(() => {
  createWindow()

  // macOS: re-create a window when the dock icon is clicked and none are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
