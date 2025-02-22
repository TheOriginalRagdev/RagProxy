const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const scraperjs = require("scraperjs");
const axios = require("axios");
const cheerio = require("cheerio");
const url = require("url");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

let visitedPages = {};

// Serve the proxy UI with a search bar and gamer-themed styling
app.get("/", (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Blank Web Page</title>
            <style>
                body { font-family: 'Courier New', monospace; background: #0d0d0d; color: #0ff; text-align: center; padding: 20px; }
                input { padding: 10px; width: 60%; background: #222; color: #0ff; border: 1px solid #0ff; }
                button { padding: 10px; background: #0ff; color: #222; border: none; cursor: pointer; }
                #results { margin-top: 20px; text-align: left; }
            </style>
        </head>
        <body>
            <h1>Gamer Heaven Proxy</h1>
            <input type="text" id="searchQuery" placeholder="Enter URL or Search">
            <button onclick="search()">Go</button>
            <div id="results"></div>
            <script>
                function search() {
                    const query = document.getElementById("searchQuery").value;
                    window.location.href = "/browse?query=" + encodeURIComponent(query);
                }
            </script>
        </body>
        </html>
    `);
});

// Function to detect and format URLs properly
function formatUrl(query) {
    if (!query.match(/^https?:\/\//)) {
        if (query.includes(".")) {
            return "https://" + query;
        } else {
            return "https://www.google.com/search?q=" + encodeURIComponent(query);
        }
    }
    return query;
}

// Incognito browsing and web scraping using ScraperJS
app.get("/browse", async (req, res) => {
    let query = formatUrl(req.query.query);
    try {
        if (query.endsWith(".php")) {
            exec(`php ${query}`, (error, stdout, stderr) => {
                if (error) {
                    res.send(`<p>PHP Error: ${stderr}</p>`);
                } else {
                    res.send(stdout);
                }
            });
            return;
        }
        
        const response = await axios.get(query, { headers: { "User-Agent": "Mozilla/5.0" } });
        const $ = cheerio.load(response.data);
        visitedPages[query] = [];
        
        // Modify all links to route through /browse
        $("a").each((_, el) => {
            let href = $(el).attr("href");
            if (href && href.startsWith("/url?q=")) {
                href = decodeURIComponent(href.split("/url?q=")[1].split("&")[0]);
            }
            if (href && !href.startsWith("http")) {
                href = new URL(href, query).href;
            }
            if (href) {
                visitedPages[query].push(href);
                $(el).attr("href", `/browse?query=${encodeURIComponent(href)}`);
            }
        });

        // Modify images to be proxied
        $("img").each((_, el) => {
            let src = $(el).attr("src");
            if (src && !src.startsWith("http")) {
                src = new URL(src, query).href;
            }
            if (src) {
                $(el).attr("src", `/proxy?url=${encodeURIComponent(src)}`);
            }
        });
        
        // Modify CSS links to ensure correct loading
        $("link[rel='stylesheet']").each((_, el) => {
            let href = $(el).attr("href");
            if (href && !href.startsWith("http")) {
                href = new URL(href, query).href;
            }
            if (href) {
                $(el).attr("href", `/proxy?url=${encodeURIComponent(href)}`);
            }
        });

        // Modify script sources to be proxied
        $("script").each((_, el) => {
            let src = $(el).attr("src");
            if (src && !src.startsWith("http")) {
                src = new URL(src, query).href;
            }
            if (src) {
                $(el).attr("src", `/proxy?url=${encodeURIComponent(src)}`);
            }
        });

        res.send($.html());
    } catch (error) {
        res.send(`<p>Error loading ${query}: ${error.message}</p>`);
    }
});

// Proxy route for external resources (images, CSS, JS)
app.get("/proxy", async (req, res) => {
    try {
        const resourceUrl = req.query.url;
        const response = await axios.get(resourceUrl, { responseType: "arraybuffer" });
        res.set("Content-Type", response.headers["content-type"]);
        res.send(response.data);
    } catch (error) {
        res.status(500).send("Error fetching resource.");
    }
});

app.listen(PORT, () => {
    console.log(`Gamer Heaven Proxy running on http://localhost:${PORT}`);
});
