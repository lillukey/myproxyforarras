const http = require('http');
const httpProxy = require('http-proxy');
const zlib = require('zlib');

const proxy = httpProxy.createProxyServer({
  target: 'https://arras.io',
  changeOrigin: true,
  followRedirects: true,
  selfHandleResponse: true,
  ws: true 
});

// 1. SPOOF THE IDENTITY (Fixes "Embedded Site" error)
proxy.on('proxyReq', function(proxyReq, req, res) {
  proxyReq.setHeader('Referer', 'https://arras.io');
  proxyReq.setHeader('Origin', 'https://arras.io');
  proxyReq.setHeader('Host', 'arras.io');
});

proxy.on('proxyRes', function (proxyRes, req, res) {
    const contentType = proxyRes.headers['content-type'] || '';
    const encoding = proxyRes.headers['content-encoding'];

    // Strip security headers that block embedding
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
            
            // Critical: Replace the "anti-frame" scripts in the game code
            content = content.replace(/window\.top !== window\.self/g, 'false');
            content = content.replace(/window\.location\.hostname !== "arras\.io"/g, 'false');
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
server.on('upgrade', (req, socket, head) => proxy.ws(req, socket, head));

const port = process.env.PORT || 10000;
server.listen(port, '0.0.0.0', () => console.log(`Stealth Arras Proxy Live`));
