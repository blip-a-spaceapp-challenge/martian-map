import { app, BrowserWindow, ipcMain } from 'electron/main'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'

const userFile = () => path.join(app.getPath('userData'), 'mission.json')
const defaultFile = () => path.join(__dirname, '../public/data/mission.json')

ipcMain.handle('mission:load', async () => {
  try {
    return JSON.parse(await fs.readFile(userFile(), 'utf8'))
  } catch {
    return JSON.parse(await fs.readFile(defaultFile(), 'utf8'))
  }
})

ipcMain.handle('mission:save', async (_event, mission: unknown) => {
  const file = userFile()
  const tmp = file + '.tmp'
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify(mission, null, 2), 'utf8')
  await fs.rename(tmp, file)
})

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: "#111",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    })
    win.webContents.on('preload-error', (_e, p, error) => {
        console.error('PRELOAD ERROR:', p, error)
    })
    win.setMenuBarVisibility(false)
    win.loadFile(path.join(__dirname, '../public/index.html'))
}

app.whenReady().then(() => {
    console.log('mission file:', userFile())
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

