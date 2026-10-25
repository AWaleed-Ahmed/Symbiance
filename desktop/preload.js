const { contextBridge, ipcRenderer } = require("electron");
const invoke = async (name, ...args) => {
    const result = await ipcRenderer.invoke("symbiance:" + name, ...args);
    if (!result.ok) throw new Error(result.error);
    return result.value;
};
contextBridge.exposeInMainWorld("symbiance", {
    getState: () => invoke("state"), makeRoom: name => invoke("make", name),
    joinRoom: invite => invoke("join", invite), leaveRoom: () => invoke("leave"),
    saveProfile: profile => invoke("profile", profile), copyInvite: () => invoke("copy"),
    openFirefox: url => invoke("firefox", url), installExtension: () => invoke("install"),
    onState: callback => {
        const listener = (event, state) => callback(state);
        ipcRenderer.on("symbiance:state", listener);
        return () => ipcRenderer.removeListener("symbiance:state", listener);
    }
});
