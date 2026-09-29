// Minimal static server with HTTP Range support.
// Replaces the Python one, which kept dropping its listener when the browser aborted
// parallel image requests mid-flight (ERR_CONNECTION_RESET / ERR_SOCKET_NOT_CONNECTED).
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = __dirname, PORT = +process.argv[2] || 8788;
const TYPES = { ".html":"text/html;charset=utf-8", ".js":"text/javascript;charset=utf-8",
  ".css":"text/css;charset=utf-8", ".json":"application/json", ".webp":"image/webp",
  ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".svg":"image/svg+xml",
  ".mp4":"video/mp4", ".woff2":"font/woff2", ".pdf":"application/pdf" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end("not found"); return; }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    const head = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    let opts = {}, code = 200;
    if (range) {
      const start = range[1] ? +range[1] : 0;
      const end = range[2] ? +range[2] : st.size - 1;
      if (start >= st.size) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }).end(); return; }
      opts = { start, end }; code = 206;
      head["Content-Range"] = `bytes ${start}-${end}/${st.size}`;
      head["Content-Length"] = end - start + 1;
    } else head["Content-Length"] = st.size;
    res.writeHead(code, head);
    if (req.method === "HEAD") return res.end();
    const s = fs.createReadStream(file, opts);
    s.on("error", () => res.destroy());
    res.on("close", () => s.destroy());     // browser aborted: stop reading, don't throw
    s.pipe(res);
  });
}).on("clientError", (e, sock) => sock.destroy())
  .listen(PORT, "127.0.0.1", () => console.log("serving on " + PORT));
