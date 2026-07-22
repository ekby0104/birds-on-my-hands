// 정적 파일 서빙 + 피드백 저장 API (의존성 없음)
// 피드백은 JSONL 파일로 저장. Railway에서 볼륨을 /data에 마운트하면 재배포에도 유지됨.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_DIR = fs.existsSync("/data") ? "/data" : ROOT;
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.jsonl");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  // 피드백 저장
  if (url.pathname === "/api/feedback" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 20000) req.destroy();
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const entry = {
          at: new Date().toISOString(),
          text: String(data.text || "").slice(0, 2000),
          ua: String(data.ua || "").slice(0, 300),
          screen: String(data.screen || "").slice(0, 20),
          detect: String(data.detect || "").slice(0, 30),
        };
        if (!entry.text.trim()) {
          res.writeHead(400);
          res.end("empty");
          return;
        }
        fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(entry) + "\n");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(400);
        res.end("bad request");
      }
    });
    return;
  }

  // 피드백 조회 (FEEDBACK_KEY 환경변수를 설정하면 ?key=로 보호됨)
  if (url.pathname === "/api/feedback" && req.method === "GET") {
    const key = process.env.FEEDBACK_KEY;
    if (key && url.searchParams.get("key") !== key) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    const raw = fs.existsSync(FEEDBACK_FILE) ? fs.readFileSync(FEEDBACK_FILE, "utf8").trim() : "";
    const list = raw
      ? raw.split("\n").map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean)
      : [];
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(list, null, 2));
    return;
  }

  // 정적 파일
  let p = decodeURIComponent(url.pathname);
  if (p === "/" || p === "") p = "/index.html";
  if (p === "/feedback") p = "/feedback.html"; // 피드백 조회 페이지
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("listening on " + (process.env.PORT || 3000) + ", feedback → " + FEEDBACK_FILE);
});
