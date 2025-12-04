const path = require('path');

module.exports = {
    mode: 'production',
    entry: {
        'api-client': './lib/api-client.js',
        'state-manager': './lib/state-manager.js',
        'error-handler': './lib/error-handler.js',
        'performance-optimizer': './lib/performance-optimizer.js',
        'tts-manager': './lib/tts-manager.js',
        'popup': './popup/popup.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: (pathData) => {
            // Put lib files in lib/dist, popup in popup/dist
            if (pathData.chunk.name === 'popup') {
                return 'popup/[name].bundle.js';
            }
            return 'lib/[name].bundle.js';
        },
        library: {
            type: 'module'
        }
    },
    experiments: {
        outputModule: true
    },
    optimization: {
        minimize: true
    },
    resolve: {
        extensions: ['.js']
    },
    target: 'web'
};
