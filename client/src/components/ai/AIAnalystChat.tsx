import { useRef, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Diamond, Send, RotateCcw, Square, Database, Loader2, User } from "lucide-react";
import { useAIAnalyst } from "@/lib/AIAnalystContext";
import { useAIAnalystChat, type ChatMessage } from "@/hooks/useAIAnalystChat";
import { cn } from "@/lib/utils";

function ToolIndicator({ name }: { name: string }) {
  const label = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-3">
      <Database className="h-3 w-3 animate-pulse" />
      <span>Querying: {label}...</span>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2 mb-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full shrink-0 mt-0.5",
          isUser ? "bg-primary" : "bg-primary/10"
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-primary-foreground" />
        ) : (
          <Diamond className="h-3.5 w-3.5 text-primary" />
        )}
      </div>
      <div
        className={cn(
          "rounded-xl px-3.5 py-2.5 max-w-[85%] text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        {message.content ? (
          <div className="whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {renderMarkdown(message.content)}
          </div>
        ) : message.isStreaming ? (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Simple markdown renderer for bold, bullet points, and line breaks
function renderMarkdown(text: string) {
  // Split into lines and process
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Bold: **text**
    const parts: React.ReactNode[] = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let partKey = 0;

    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push(<strong key={`b${partKey++}`}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    const content = parts.length > 0 ? parts : line;

    // Bullet points
    if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="text-muted-foreground shrink-0">•</span>
          <span>{typeof content === "string" ? content.slice(2) : parts.length > 0 ? parts : line.slice(2)}</span>
        </div>
      );
    } else if (line.startsWith("*") && !line.startsWith("**") && line.endsWith("*")) {
      // Italic disclaimer
      elements.push(
        <p key={i} className="text-xs text-muted-foreground italic mt-2">{line.slice(1, -1)}</p>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i}>{content}</p>);
    }
  }

  return <>{elements}</>;
}

export function AIAnalystChat() {
  const { isOpen, close } = useAIAnalyst();
  const { messages, isStreaming, activeTool, sendMessage, clearChat, stopStreaming } = useAIAnalystChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, activeTool]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    "How many $0 premium plans are in Florida?",
    "Compare UnitedHealthcare vs Humana in Texas",
    "What's the best dental plan in Miami-Dade?",
    "Top 5 plans with highest OTC benefits",
  ];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="w-full sm:w-[440px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Diamond className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <SheetTitle className="text-sm">Prism AI</SheetTitle>
                <p className="text-xs text-muted-foreground">Medicare data analyst</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearChat} title="New chat">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <Diamond className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Ask Prism AI anything</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
                I can query 171,906 Medicare plans, compare carriers, and find the data you need.
              </p>
              <div className="space-y-2 w-full max-w-[320px]">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-sm p-2.5 rounded-lg border hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {activeTool && <ToolIndicator name={activeTool} />}
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about plans, carriers, benefits..."
              rows={1}
              className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px] max-h-[120px]"
              style={{ height: "auto", overflow: "hidden" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={stopStreaming}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleSend} disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            AI-powered analysis of CMS CY2026 data. Always verify before enrolling.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
