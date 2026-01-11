import { contextBridge, ipcRenderer } from 'electron';

export interface FileData {
  path: string;
  data: number[];
}

export interface ImageData {
  data: number[];
  type: 'png' | 'jpg';
}

export interface SaveResult {
  success: boolean;
  path?: string;
  error?: string;
  canceled?: boolean;
}

const electronAPI = {
  openFile: (): Promise<FileData | null> => ipcRenderer.invoke('open-file-dialog'),
  openImage: (): Promise<ImageData | null> => ipcRenderer.invoke('open-image-dialog'),
  saveFile: (filePath: string, data: number[]): Promise<SaveResult> =>
    ipcRenderer.invoke('save-file', { path: filePath, data }),
  saveFileAs: (data: number[]): Promise<SaveResult> =>
    ipcRenderer.invoke('save-file-dialog', data),

  // Menu event listeners
  onMenuSave: (callback: () => void) => {
    ipcRenderer.on('menu-save', callback);
    return () => ipcRenderer.removeListener('menu-save', callback);
  },
  onMenuUndo: (callback: () => void) => {
    ipcRenderer.on('menu-undo', callback);
    return () => ipcRenderer.removeListener('menu-undo', callback);
  },
  onMenuRedo: (callback: () => void) => {
    ipcRenderer.on('menu-redo', callback);
    return () => ipcRenderer.removeListener('menu-redo', callback);
  },
  onMenuDelete: (callback: () => void) => {
    ipcRenderer.on('menu-delete', callback);
    return () => ipcRenderer.removeListener('menu-delete', callback);
  },
  onZoomIn: (callback: () => void) => {
    ipcRenderer.on('menu-zoom-in', callback);
    return () => ipcRenderer.removeListener('menu-zoom-in', callback);
  },
  onZoomOut: (callback: () => void) => {
    ipcRenderer.on('menu-zoom-out', callback);
    return () => ipcRenderer.removeListener('menu-zoom-out', callback);
  },
  onFitWidth: (callback: () => void) => {
    ipcRenderer.on('menu-fit-width', callback);
    return () => ipcRenderer.removeListener('menu-fit-width', callback);
  },
  onFitPage: (callback: () => void) => {
    ipcRenderer.on('menu-fit-page', callback);
    return () => ipcRenderer.removeListener('menu-fit-page', callback);
  },
  onFileOpened: (callback: (data: { path: string; data: number[] }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { path: string; data: number[] }) => callback(data);
    ipcRenderer.on('file-opened', handler);
    return () => ipcRenderer.removeListener('file-opened', handler);
  },
  onSaveFileAs: (callback: (filePath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('save-file-as', handler);
    return () => ipcRenderer.removeListener('save-file-as', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
