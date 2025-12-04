export class ScreenshotManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * Capture a screenshot using Chrome's tab capture API
     * @returns {Promise<string>} Base64 encoded image
     */
    async captureVisibleTab() {
        try {
            // Use Chrome API to capture visible tab
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                format: 'png'
            });
            return dataUrl;
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            throw new Error('Screenshot capture failed. Please ensure you have granted the necessary permissions.');
        }
    }

    /**
     * Capture screen area using screen capture API (for area selection)
     * This is more advanced and requires user interaction
     * @returns {Promise<string>} Base64 encoded image
     */
    async captureArea() {
        try {
            // Request screen capture
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    mediaSource: 'screen',
                    cursor: 'never'
                }
            });

            // Create video element to capture frame
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            // Wait for video to be ready
            await new Promise(resolve => {
                video.onloadedmetadata = resolve;
            });

            // Create canvas and capture frame
            this.canvas = document.createElement('canvas');
            this.canvas.width = video.videoWidth;
            this.canvas.height = video.videoHeight;
            this.ctx = this.canvas.getContext('2d');
            this.ctx.drawImage(video, 0, 0);

            // Stop the stream
            stream.getTracks().forEach(track => track.stop());

            // Convert to base64
            const dataUrl = this.canvas.toDataURL('image/png');
            return dataUrl;
        } catch (error) {
            console.error('Failed to capture screen area:', error);
            throw new Error('Screen capture cancelled or failed.');
        }
    }

    /**
     * Convert data URL to blob
     * @param {string} dataUrl 
     * @returns {Blob}
     */
    dataURLtoBlob(dataUrl) {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    /**
     * Resize image if too large (to save API costs)
     * @param {string} dataUrl 
     * @param {number} maxWidth 
     * @param {number} maxHeight 
     * @returns {Promise<string>}
     */
    async resizeImage(dataUrl, maxWidth = 1920, maxHeight = 1080) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }

                // Create canvas and resize
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/png'));
            };
            img.src = dataUrl;
        });
    }

    /**
     * Extract base64 data from data URL
     * @param {string} dataUrl 
     * @returns {string}
     */
    extractBase64(dataUrl) {
        return dataUrl.split(',')[1];
    }
}
