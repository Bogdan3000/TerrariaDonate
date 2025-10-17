import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 850,
        backgroundColor: '#0f0f23',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: path.join(__dirname, 'web', 'icon.png') // добавь иконку при желании
    });

    mainWindow.loadURL('http://localhost:8080');
    mainWindow.removeMenu();

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (serverProcess) serverProcess.kill();
    });
}

// Запуск backend-сервера
function startServer() {
    const serverPath = path.join(__dirname, 'server', 'index.js');
    serverProcess = spawn('node', [serverPath], { stdio: 'inherit' });
}

// События Electron
app.whenReady().then(() => {
    startServer();
    setTimeout(createWindow, 1500); // ждём пока Express поднимется
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});