import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { initDatabase } from "./db/index";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Initialize database before starting server
  try {
    console.log("🔄 Initializing database...");
    await initDatabase("prod");
    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    console.error("⚠️  Run `npm run migrate:run` to create database tables");
    process.exit(1); // Exit if database cannot be initialized
  }

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Store crawler status and emit to connected clients
  let currentCrawlerStatus: any = null;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send current status to newly connected client
    if (currentCrawlerStatus) {
      socket.emit("crawlerStatus", currentCrawlerStatus);
    }

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Export function to update crawler status from anywhere
  (global as any).updateCrawlerStatus = (status: any) => {
    currentCrawlerStatus = status;
    io.emit("crawlerStatus", status);
  };

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
