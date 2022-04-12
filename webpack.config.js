const path = require('path');

module.exports = {
    mode: 'development',
    entry: './pages/chat/src/pages/chat/ts/script.js', 
    output: {
        filename: 'script.js',
        path: path.resolve(__dirname, 'pages', 'chat'),
    },
    experiments: {
        topLevelAwait: true,
    }
};