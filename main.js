import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fetch from "node-fetch";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let serverProcess;

function resolveServerPath() {
    // ищем сервер рядом с exe или внутри asar
    const localPath = path.join(process.resourcesPath, "app.asar.unpacked", "server", "index.js");
    const devPath = path.join(__dirname, "server", "index.js");

    if (fs.existsSync(devPath)) return devPath;
    if (fs.existsSync(localPath)) return localPath;

    console.error("❌ Не найден server/index.js");
    return null;
}

function startServer() {
    const serverPath = resolveServerPath();
    if (!serverPath) return;

    console.log("🚀 Запуск backend:", serverPath);

    serverProcess = spawn(process.execPath, [serverPath], { stdio: "inherit" });

    serverProcess.on("error", (err) => {
        console.error("❌ Ошибка при запуске сервера:", err);
    });

    serverProcess.on("exit", (code) => {
        console.error("⚠️ Сервер завершился с кодом:", code);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 850,
        backgroundColor: "#0f0f23",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, "web", "icon.png"),
    });

    mainWindow.loadURL("http://localhost:8080");
    mainWindow.removeMenu();

    mainWindow.on("closed", () => {
        if (serverProcess) serverProcess.kill();
        mainWindow = null;
    });
}

async function waitForServer() {
    const url = "http://localhost:8080";
    for (let i = 0; i < 20; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return true;
        } catch {}
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

app.whenReady().then(async () => {
    startServer();
    const ready = await waitForServer();
    if (ready) {
        createWindow();
    } else {
        const fail = new BrowserWindow({ width: 500, height: 300 });
        fail.loadURL("data:text/html,<h2 style='color:white;text-align:center;margin-top:100px;background:#0f0f23'>Ошибка запуска сервера</h2>");
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});