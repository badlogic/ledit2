const http = require("http");
const url = require("url");

const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === "GET" && req.url.startsWith("/api/json")) {
        const queryObject = url.parse(req.url, true).query;
        const targetUrl = queryObject.url;

        if (!targetUrl) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "No URL provided" }));
            return;
        }

        try {
            const resp = await fetch(targetUrl);
            if (!resp.ok) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: await resp.text() }));
            } else {
                res.writeHead(200, {
                    "Content-Type": "application/json",
                    "Transfer-Encoding": "chunked"
                });
                const reader = resp.body?.getReader();
                if (reader) {
                    while (true) {
                        const {done, value} = await reader.read();
                        if (done) break;
                        res.write(value);
                    }
                    res.end();
                }
            }
        } catch (error) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: error.message }));
        }
    } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
