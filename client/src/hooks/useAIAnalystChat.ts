import { useState, useRef, useCallback } from "react";
import { useAuth } from "./useAuth";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  toolName?: string;
}

interface ChatChunk {
  type: "content" | "tool_start" | "tool_result" | "done" | "error";
  text?: string;
  toolName?: string;
}

export function useAIAnalystChat() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setActiveTool(null);

    // Build message history for API (only role + content)
    const apiMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Get page context
    const context = {
      currentPage: window.location.pathname,
    };

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: apiMessages, context }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Chat request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          let chunk: ChatChunk;
          try {
            chunk = JSON.parse(json);
          } catch {
            continue;
          }

          switch (chunk.type) {
            case "content":
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + (chunk.text || "") };
                }
                return updated;
              });
              break;
            case "tool_start":
              setActiveTool(chunk.toolName || null);
              break;
            case "tool_result":
              setActiveTool(null);
              break;
            case "error":
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: chunk.text || "An error occurred.", isStreaming: false };
                }
                return updated;
              });
              break;
            case "done":
              break;
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            updated[updated.length - 1] = { ...last, content: "Failed to get a response. Please try again.", isStreaming: false };
          }
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      setActiveTool(null);
      abortRef.current = null;
      // Mark streaming done
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.isStreaming) {
          updated[updated.length - 1] = { ...last, isStreaming: false };
        }
        return updated;
      });
    }
  }, [messages, isStreaming, token]);

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setIsStreaming(false);
    setActiveTool(null);
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return {
    messages,
    isStreaming,
    activeTool,
    sendMessage,
    clearChat,
    stopStreaming,
  };
}
