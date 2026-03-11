"use client";

import { FlaskConical, Bot, TrendingUp, Trophy } from "lucide-react";

export default function ABTestsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            A/B Tests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test prompt variants and auto-deploy winners
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium">1. Create Variants</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Go to any agent&apos;s page and create prompt variants to test
            different instructions.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-yellow-500" />
            </div>
            <span className="text-sm font-medium">2. Run & Measure</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Each execution randomly uses a variant. Success rate, speed, and
            cost are tracked automatically.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-green-500" />
            </div>
            <span className="text-sm font-medium">3. Deploy Winner</span>
          </div>
          <p className="text-xs text-muted-foreground">
            When a variant outperforms the control by 15%+, deploy it as the new
            default prompt.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <FlaskConical className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Create prompt variants on agent pages to start A/B testing
        </p>
      </div>
    </div>
  );
}
