const http = require('http');
const httpProxy = require('http-proxy');
const zlib = require('zlib');

const proxy = httpProxy.createProxyServer({
  target: 'https://www.crazygames.com',
  changeOrigin: true,
  followRedirects: true,
  selfHandleResponse: true,
  ws: true 
});

// 1. SPOOF THE IDENTITY (Fixes "Embedded Site" error)
proxy.on('proxyReq', function(proxyReq, req, res) {
  proxyReq.setHeader('Referer', 'https://www.crazygames.com');
  proxyReq.setHeader('Origin', 'https://www.crazygames.com');
  proxyReq.setHeader('Host', 'crazygames.com');
});

proxy.on('proxyRes', function (proxyRes, req, res) {
    const contentType = proxyRes.headers['content-type'] || '';
    const encoding = proxyRes.headers['content-encoding'];
    
    // ADD THIS LINE: It removes the "Integrity" check that blocks modified scripts
    delete proxyRes.headers['x-webkit-csp'];
    delete proxyRes.headers['content-security-policy'];
    
    // Some games use "Link" headers to pre-load scripts; we need to clear those too
    delete proxyRes.headers['link'];

    // Strip security headers that block embedding
    delete proxyRes.headers['content-security-policy'];
    delete proxyRes.headers['x-frame-options'];
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Replace your current if (contentType.includes(...)) with this:
    if (contentType.includes('text/html')) {
        // ONLY rewrite HTML. Do not touch JS or CSS for now to avoid corruption.
        let body = [];
        proxyRes.on('data', chunk => body.push(chunk));
        proxyRes.on('end', () => {
            let buffer = Buffer.concat(body);
            try {
                if (encoding === 'gzip') buffer = zlib.gunzipSync(buffer);
                else if (encoding === 'deflate') buffer = zlib.inflateSync(buffer);
                else if (encoding === 'br') buffer = zlib.brotliDecompressSync(buffer);
            } catch (e) {
                return res.end(buffer); // If decompression fails, send raw
            }
    
            let content = buffer.toString('utf8');
            const host = req.headers.host;
    
            res.setHeader('Content-Type', 'text/html');
            res.end(content);
        });
    } else {
        // For ALL other files (JS, CSS, Images), pipe them exactly as they are
        Object.keys(proxyRes.headers).forEach(key => res.setHeader(key, proxyRes.headers[key]));
        proxyRes.pipe(res);
    }

});

const server = http.createServer((req, res) => proxy.web(req, res));
server.on('upgrade', (req, socket, head) => proxy.ws(req, socket, head));

const port = process.env.PORT || 10000;
server.listen(port, '0.0.0.0', () => console.log(`Stealth Arras Proxy Live`));
