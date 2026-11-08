import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

// This server serves the built frontend only. All identity and personal data use Supabase.
// Existing local account archives are deliberately left untouched.
const root = resolve(import.meta.dirname, "dist");
const port = Number(process.env.PORT || 4173);
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};
createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Permissions-Policy",
    "geolocation=(self), camera=(), microphone=()",
  );
  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  try {
    const path = decodeURIComponent(
      new URL(request.url || "/", "http://localhost").pathname,
    );
    if (path.split("/").some((part) => part.startsWith(".") || part === "..")) {
      response.writeHead(404);
      response.end();
      return;
    }
    const file = resolve(
      root,
      `.${path.endsWith("/") ? `${path}index.html` : path}`,
    );
    if (!file.startsWith(`${root}${sep}`)) {
      response.writeHead(403);
      response.end();
      return;
    }
    const content = await readFile(file);
    response.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Cache-Control": path.includes("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("გვერდი ვერ მოიძებნა.");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`PetLog: http://127.0.0.1:${port}`),
);
