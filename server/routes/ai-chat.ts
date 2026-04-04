import type { Express } from "express";
import { streamAnalystChat, type ChatMessage, type ChatContext } from "../services/ai-analyst.service";

export function registerAIChatRoutes(app: Express) {
  // ── POST /api/ai/chat ──
  // Streaming chat with the Prism AI analyst
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, context } = req.body as {
        messages?: ChatMessage[];
        context?: ChatContext;
      };

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }

      // Validate messages
      for (const msg of messages) {
        if (!msg.role || !msg.content) {
          return res.status(400).json({ error: "Each message must have role and content" });
        }
      }

      // Set SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      // Handle client disconnect
      let aborted = false;
      req.on("close", () => {
        aborted = true;
      });

      await streamAnalystChat(
        messages,
        context || {},
        (chunk) => {
          if (aborted) return;
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        },
      );

      if (!aborted) {
        res.end();
      }
    } catch (err: any) {
      console.error("AI chat error:", err.message);
      // If headers already sent (streaming started), send error as SSE
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", text: "An error occurred. Please try again." })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "AI chat failed" });
      }
    }
  });
}
