const http = require("http");
const fs = require("fs");
const path = require("path");

const DB = "./data.json";
const DIST = path.join(__dirname, "dist");

const MIME = {
  ".html": "text/html",
  ".js":   "text/javascript",
  ".css":  "text/css",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

const read = () => {
  try { return JSON.parse(fs.readFileSync(DB, "utf8")); }
  catch { return {}; }
};

const write = (data) => fs.writeFileSync(DB, JSON.stringify(data, null, 2));

const serveStatic = (req, res) => {
  const filePath = path.join(DIST, req.url === "/" ? "index.html" : req.url);
  const fallback = path.join(DIST, "index.html");
  const target = fs.existsSync(filePath) ? filePath : fallback;
  const ext = path.extname(target);
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  res.writeHead(200);
  res.end(fs.readFileSync(target));
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET" && req.url === "/data") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify(read()));
    return;
  }

  if (req.method === "PATCH" && req.url.startsWith("/data/")) {
    const key = req.url.slice(6);
    let body = "";
    let size = 0;
    const LIMIT = 5 * 1024 * 1024; // 5 MB
    req.on("data", chunk => {
      size += chunk.length;
      if (size > LIMIT) { res.writeHead(413); res.end("Payload too large"); req.destroy(); return; }
      body += chunk;
    });
    req.on("end", () => {
      let parsed;
      try { parsed = JSON.parse(body); }
      catch { res.writeHead(400); res.end("Invalid JSON"); return; }
      const db = read();
      db[key] = parsed;
      write(db);
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(3001, () => console.log("Server → http://localhost:3001"));
