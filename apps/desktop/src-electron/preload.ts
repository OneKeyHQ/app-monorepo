import { contextBridge } from 'electron';

const desktopApi = {};
contextBridge.exposeInMainWorld('desktopApi', desktopApi);
