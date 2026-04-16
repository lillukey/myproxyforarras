const http = require('http');
const httpProxy = require('http-proxy');
const zlib = require('zlib');

// Create the proxy server
const proxy = httpProxy.createProxyServer({
  target: 'https://arras.io',
  changeOrigin: true,
  autoRewrite: true,
  followRedirects: true,
  selfHandleResponse: true,
  ws: true // ENABLE WEBSOCKETS FOR GAMEPLAY
});

proxy.on('proxyRes', function (proxyRes, req, res) {
    const contentType = proxyRes.headers['content-type'] || '';
    const encoding = proxyRes.headers['content-encoding'];

    // Strip Security to allow it to run on your URL
    delete proxyRes.headers['content-security-policy'];
    delete proxyRes.headers['x-frame-options'];
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (contentType.includes('text/html') || contentType.includes('application/javascript')) {
        let body = [];
        proxyRes.on('data', chunk => body.push(chunk));
        proxyRes.on('end', () => {
            let buffer = Buffer.concat(body);
            try {
                if (encoding === 'gzip') buffer = zlib.gunzipSync(buffer);
                else if (encoding === 'deflate') buffer = zlib.inflateSync(buffer);
                else if (encoding === 'br') buffer = zlib.brotliDecompressSync(buffer);
            } catch (e) {}

            let content = buffer.toString('utf8');
            const host = req.headers.host;
            
            // Swap all arras.io links for YOUR Render URL
            content = content.replace(/arras\.io/g, host);

            delete proxyRes.headers['content-encoding'];
            delete proxyRes.headers['content-length'];
            Object.keys(proxyRes.headers).forEach(key => res.setHeader(key, proxyRes.headers[key]));
            res.end(content);
        });
    } else {
        Object.keys(proxyRes.headers).forEach(key => res.setHeader(key, proxyRes.headers[key]));
        proxyRes.pipe(res);
    }
});

const server = http.createServer((req, res) => proxy.web(req, res));

// THIS SECTION IS CRITICAL FOR GAMES: It handles the actual game data (WebSockets)
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

const port = process.env.PORT || 10000;
server.listen(port, '0.0.0.0', () => console.log(`Arras Proxy Live on ${port}`));
