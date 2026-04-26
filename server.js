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
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const db = read();
      db[key] = JSON.parse(body);
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
