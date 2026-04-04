import { createContext, useContext, useState, type ReactNode } from "react";

interface AIAnalystContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const AIAnalystContext = createContext<AIAnalystContextType | null>(null);

export function AIAnalystProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <AIAnalystContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((v) => !v),
      }}
    >
      {children}
    </AIAnalystContext.Provider>
  );
}

export function useAIAnalyst() {
  const ctx = useContext(AIAnalystContext);
  if (!ctx) throw new Error("useAIAnalyst must be used within AIAnalystProvider");
  return ctx;
}
