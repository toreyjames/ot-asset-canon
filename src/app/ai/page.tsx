"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
}

export default function AIQueryPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <AIQueryPageInner />
    </Suspense>
  );
}

function AIQueryPageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-submit if there's an initial query
  useEffect(() => {
    if (initialQuery && messages.length === 0) {
      handleSubmit(new Event("submit") as unknown as React.FormEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, stream: false }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.text || "I couldn't generate a response.",
        toolCalls: data.toolCalls?.map((tc: { toolName: string; args: Record<string, unknown> }, i: number) => ({
          name: tc.toolName,
          args: tc.args,
          result: data.toolResults?.[i]?.result,
        })),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQueries = [
    "What happens if an attacker manipulates the setpoint on reactor temperature controller TIC-101?",
    "Trace the attack path from vendor VPN access to the reactor safety system",
    "Calculate the consequence if cooling water is lost to reactor R-101 at 450°F",
    "Which assets have critical CVEs AND control safety-instrumented functions?",
    "What's the adiabatic temperature rise if the exothermic reaction in R-101 loses cooling?",
    "Show me all Layer 3 controllers with firmware more than 2 versions behind",
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          AI-Powered Canon Query
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Ask questions about your plant using natural language. The AI has access to
          Canon asset data and physics calculation tools.
        </p>
      </div>

      {/* Messages */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg mb-4 min-h-[400px] max-h-[600px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Example Queries
            </h3>
            <div className="grid gap-2">
              {exampleQueries.map((query, i) => (
                <button
                  key={i}
                  onClick={() => setInput(query)}
                  className="text-left p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((message, i) => (
              <MessageBubble key={i} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="animate-pulse flex gap-1">
                  <span className="w-2 h-2 bg-layer5 rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-layer5 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <span
                    className="w-2 h-2 bg-layer5 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
                <span className="text-sm">Analyzing Canon data...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about assets, attack paths, consequences, or calculate physics..."
          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-layer5"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-3 bg-layer5 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
        >
          {isLoading ? "Analyzing..." : "Ask"}
        </button>
      </form>

      {/* Tool Legend */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Available Tools
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <ToolBadge name="searchAssets" category="Canon" />
          <ToolBadge name="getAssetRelationships" category="Canon" />
          <ToolBadge name="getAttackPaths" category="Canon" />
          <ToolBadge name="getConsequenceChain" category="Canon" />
          <ToolBadge name="adiabaticTemperatureRise" category="Thermo" />
          <ToolBadge name="timeToMaximumRate" category="Thermo" />
          <ToolBadge name="reliefValveSizing" category="Fluid" />
          <ToolBadge name="gaussianPlumeDispersion" category="Consequence" />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          isUser
            ? "bg-layer5 text-white"
            : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>

        {/* Tool Calls Display */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
            <p className="text-xs font-medium opacity-75 mb-2">Tools Used:</p>
            <div className="space-y-2">
              {message.toolCalls.map((tc, i) => (
                <details key={i} className="text-xs">
                  <summary className="cursor-pointer hover:opacity-80">
                    <span className="font-mono bg-black/20 px-1 rounded">
                      {tc.name}
                    </span>
                  </summary>
                  <div className="mt-1 p-2 bg-black/10 rounded text-xs overflow-x-auto">
                    <div className="mb-1">
                      <strong>Input:</strong>
                      <pre className="mt-1">{JSON.stringify(tc.args, null, 2)}</pre>
                    </div>
                    {tc.result !== undefined && (
                      <div>
                        <strong>Output:</strong>
                        <pre className="mt-1">
                          {JSON.stringify(tc.result as object, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolBadge({ name, category }: { name: string; category: string }) {
  const categoryColors: Record<string, string> = {
    Canon: "bg-layer5/20 text-layer5",
    Thermo: "bg-layer1/20 text-layer1",
    Fluid: "bg-layer2/20 text-layer2",
    Consequence: "bg-layer3/20 text-layer3",
  };

  return (
    <span
      className={`px-2 py-1 rounded ${categoryColors[category] || "bg-gray-200"}`}
    >
      {name}
    </span>
  );
}
