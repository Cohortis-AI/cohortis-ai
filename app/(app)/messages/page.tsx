"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
  MessageSquare,
  Bot,
  ArrowRight,
  Radio,
  FileEdit,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { fetcher } from "@/lib/api-client";

const PAGE_SIZE = 50;

const typeIcons: Record<string, typeof ArrowRight> = {
  delegation: ArrowRight,
  report: MessageSquare,
  broadcast: Radio,
  prompt_update: FileEdit,
};

const typeLabels: Record<string, string> = {
  delegation: "Delegation",
  report: "Report",
  broadcast: "Broadcast",
  prompt_update: "Prompt Update",
};

const typeColors: Record<string, string> = {
  delegation: "text-blue-400 bg-blue-400/10",
  report: "text-green-400 bg-green-400/10",
  broadcast: "text-amber-400 bg-amber-400/10",
  prompt_update: "text-purple-400 bg-purple-400/10",
};

export default function MessagesPage() {
  const [filter, setFilter] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const url = filter
    ? `/api/messages?limit=${PAGE_SIZE}&type=${filter}`
    : `/api/messages?limit=${PAGE_SIZE}`;

  const { isLoading } = useSWR(url, fetcher, {
    refreshInterval: 5000,
    onSuccess: (data) => {
      const msgs = Array.isArray(data) ? data : [];
      // Reset on filter change or first load
      if (!initialized || offset === 0) {
        setAllMessages(msgs);
        setHasMore(msgs.length >= PAGE_SIZE);
        setInitialized(true);
      }
    },
  });

  // Reset pagination when filter changes
  const handleFilterChange = (newFilter: string | null) => {
    setFilter(newFilter);
    setAllMessages([]);
    setOffset(0);
    setHasMore(true);
    setInitialized(false);
  };

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const nextOffset = offset + PAGE_SIZE;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });
      if (filter) params.set("type", filter);

      const data = await fetcher(`/api/messages?${params}`);
      const newMessages = Array.isArray(data) ? data : [];
      setAllMessages((prev) => [...prev, ...newMessages]);
      setOffset(nextOffset);
      setHasMore(newMessages.length >= PAGE_SIZE);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [offset, filter]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Agent Communications</h1>
          <p className="text-sm text-muted-foreground">
            Inter-agent messages, delegations, and prompt updates
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleFilterChange(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !filter
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          All
        </button>
        {["delegation", "report", "broadcast", "prompt_update"].map((type) => (
          <button
            key={type}
            onClick={() =>
              handleFilterChange(filter === type ? null : type)
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === type
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {typeLabels[type]}
          </button>
        ))}
      </div>

      {/* Messages list */}
      {isLoading && !initialized ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : allMessages.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No agent messages yet. Run a team chat or agent execution to see
            communications here.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {allMessages.map((item: any) => {
              const msg = item.message;
              const Icon = typeIcons[msg.type] || MessageSquare;
              const colorClass =
                typeColors[msg.type] || "text-muted-foreground bg-secondary";

              return (
                <div
                  key={msg.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-border transition-colors"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium">
                        {item.senderName || "Unknown Agent"}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colorClass}`}
                      >
                        {typeLabels[msg.type]}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {msg.content}
                    </p>
                    {msg.metadata?.source && (
                      <span className="text-[10px] text-muted-foreground/60 mt-1 inline-block">
                        via {msg.metadata.source}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
