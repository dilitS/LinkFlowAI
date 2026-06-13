// Offscreen document for audio playback and Piper TTS (WASM)
// Manifest V3 prevents Service Workers from using AudioContext, so we do it here.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'play_piper_tts') {
        handlePiperTTS(request.text, request.voiceId)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async
    } else if (request.action === 'stop_tts') {
        stopAllAudio();
        sendResponse({ success: true });
        return false;
    }
});

let currentAudioContext = null;

async function handlePiperTTS(text, voiceId) {
    // 1. Fetch voice model from IndexedDB (downloaded by settings UI)
    const modelData = await getVoiceFromDB(voiceId);
    if (!modelData) {
        throw new Error('Voice model not found. Please download it in settings.');
    }

    // 2. Initialize Piper (assuming piper.js exposes a global or module API)
    // NOTE: This is a placeholder for the actual Piper WASM initialization
    // const piper = new Piper(modelData.onnx, modelData.json);
    // const audioBuffer = await piper.synthesize(text);
    
    // 3. Play audio
    // await playAudioBuffer(audioBuffer);
    
    console.warn("Piper WASM integration is a placeholder. Awaiting piper.wasm and piper.js.");
    throw new Error('Piper WASM engine is not yet supplied in lib/piper/piper.js');
}

function stopAllAudio() {
    if (currentAudioContext) {
        currentAudioContext.close();
        currentAudioContext = null;
    }
}

// IndexedDB Helper
function getVoiceFromDB(voiceId) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LingFlowTTS', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('voices', 'readonly');
            const store = tx.objectStore('voices');
            const getReq = store.get(voiceId);
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = () => reject(getReq.error);
        };
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            db.createObjectStore('voices', { keyPath: 'id' });
        };
    });
}
