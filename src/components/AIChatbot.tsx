import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, ArrowDown } from "lucide-react";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
}

export const AIChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg_welcome",
      sender: "bot",
      text: "Hello! SNGxJOURNAL AI Assistant active. English, Sinhala (සිංහලෙන්), or Singlish (e.g. 'kohomada log wenne', 'plan eka set කරන්නේ kohomada') support ready!",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = chatContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      isNearBottomRef.current = true;
      setShowScrollBtn(false);
    }
  };

  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const isNear = distanceFromBottom < 80;
    isNearBottomRef.current = isNear;
    setShowScrollBtn(!isNear);
  };

  // Scroll to bottom on initial open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollToBottom("auto"), 50);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputMsg.trim() || loading) return;

    const userText = inputMsg.trim();
    setInputMsg("");

    const userMsgObj: Message = {
      id: "usr_" + Date.now(),
      sender: "user",
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsgObj]);
    setTimeout(() => scrollToBottom("smooth"), 40);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      let botReplyText = "Assistant active. Direct support line: +94 75 284 0841.";
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const data = await res.json();
        if (data.reply) botReplyText = data.reply;
      }

      const botMsgObj: Message = {
        id: "bot_" + Date.now(),
        sender: "bot",
        text: botReplyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsgObj]);
      if (isNearBottomRef.current) {
        setTimeout(() => scrollToBottom("smooth"), 40);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: "bot_err_" + Date.now(),
          sender: "bot",
          text: "Support Assistant: Server connected. Contact support line +94 75 284 0841 for quick access assistance.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      if (isNearBottomRef.current) {
        setTimeout(() => scrollToBottom("smooth"), 40);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/40 border border-indigo-400 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Open SNGxJOURNAL AI Assistant"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950"></span>
      </button>

      {/* Chatbot Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-96 h-[420px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-slate-950 p-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white leading-tight">
                  SNGxJOURNAL AI Assistant
                </h4>
                <p className="text-[10px] text-emerald-400 font-mono">
                  Online (EN / SI / Singlish)
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 relative overflow-hidden flex flex-col">
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 p-3.5 overflow-y-auto space-y-3 font-sans text-xs"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2 ${
                    m.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.sender === "bot" && (
                    <div className="w-6 h-6 rounded-md bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] p-2.5 rounded-xl text-xs leading-relaxed ${
                      m.sender === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none font-medium"
                        : "bg-slate-950 text-slate-200 border border-slate-800 rounded-tl-none"
                    }`}
                  >
                    <p>{m.text}</p>
                    <span className="text-[9px] text-slate-400 block text-right mt-1 font-mono">
                      {m.time}
                    </span>
                  </div>

                  {m.sender === "user" && (
                    <div className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2 items-center text-slate-400 text-xs font-mono">
                  <Bot className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>

            {/* Jump to latest button */}
            {showScrollBtn && (
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className="absolute bottom-2 right-4 z-20 px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[11px] font-bold flex items-center gap-1 shadow-lg shadow-indigo-600/40 border border-indigo-400/40 transition-all hover:scale-105 active:scale-95"
              >
                <ArrowDown className="w-3 h-3 animate-bounce" />
                <span>Jump to latest</span>
              </button>
            )}
          </div>

          {/* Input Area */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about login, trade journal, or Sinhala help..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
            />
            <button
              onClick={handleSend}
              disabled={loading || !inputMsg.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
