const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');

// Same code ships as two apps: myNexus (default) and the standalone myProjects
// (installer built with "mode": "projects", or run with --projects).
const PROJECTS = require('./package.json').mode === 'projects' || process.argv.includes('--projects');
const NAME = PROJECTS ? 'myProjects' : 'myNexus';
app.setName(NAME);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    fullscreen: true,
    backgroundColor: '#1a0f26',
    title: NAME,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.setMenu(null);
  win.loadFile(PROJECTS ? 'projects.html' : 'index.html');

  // Always fits the screen: the app is designed on a fixed canvas (900px tall, at least 1280px wide) and the whole
  // page is zoomed to the real window, so every screen size and window size gets the exact layout that was verified.
  const CANVAS_H = 900, CANVAS_MIN_W = 1280;
  const display = () => screen.getDisplayMatching(win.getBounds());
  const { width: sw, height: sh } = display().bounds;
  win.setAspectRatio(sw / sh);
  const rescale = () => { const { width, height } = win.getContentBounds(); win.webContents.setZoomFactor(Math.min(height / CANVAS_H, width / CANVAS_MIN_W)); };
  win.on('resize', rescale);

  const sendState = () => { rescale(); win.webContents.send('win:state', win.isFullScreen()); };
  win.on('enter-full-screen', sendState);
  win.on('leave-full-screen', () => {
    // Windowed = 60% of the screen, centered
    const d = display();
    const { x, y, width, height } = d.workArea;
    const w = Math.round(d.bounds.width * 0.6), h = Math.round(d.bounds.height * 0.6);
    win.setBounds({ x: x + Math.round((width - w) / 2), y: y + Math.round((height - h) / 2), width: w, height: h });
    sendState();
  });
  win.webContents.on('did-finish-load', sendState);

  ipcMain.on('win:min', () => win.minimize());
  ipcMain.on('win:toggle', () => win.setFullScreen(!win.isFullScreen()));
  ipcMain.on('win:close', () => win.close());
  return win;
}

// Auto-update: the installed app checks for a newer release on launch and every 4 hours, downloads it
// quietly, then offers a restart (or installs when you next close the app). Only works in the installed app.
function setupUpdates(win) {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', () => {});
  autoUpdater.on('update-downloaded', info => {
    dialog.showMessageBox(win, { type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, title: 'myNexus update', message: `myNexus ${info.version} is ready`, detail: 'Restart to finish updating. Your data stays saved.' })
      .then(r => { if (r.response === 0) autoUpdater.quitAndInstall(); });
  });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check(); setInterval(check, 4 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  setupUpdates(createWindow());
  // Save the login and local data to disk every 20s, so a crash or forced close can't lose the session
  const { session } = require('electron');
  setInterval(() => session.defaultSession.flushStorageData(), 20000);
});
app.on('before-quit', () => require('electron').session.defaultSession.flushStorageData());
app.on('window-all-closed', () => app.quit());
