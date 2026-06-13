export class PiperManager {
    constructor() {
        this.dbName = 'LingFlowTTS';
        this.storeName = 'voices';
        this.version = 1;
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    async hasVoice(voiceId) {
        if (!voiceId) return false;
        try {
            const db = await this.initDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const req = store.get(voiceId);
                req.onsuccess = () => resolve(!!req.result);
                req.onerror = () => resolve(false);
            });
        } catch (e) {
            return false;
        }
    }

    async deleteVoice(voiceId) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.delete(voiceId);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async saveVoice(voiceId, onnxBuffer, jsonBuffer) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.put({
                id: voiceId,
                onnx: onnxBuffer,
                json: jsonBuffer,
                timestamp: Date.now()
            });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
}

export const piperManager = new PiperManager();
