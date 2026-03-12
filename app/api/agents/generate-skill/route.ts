import { NextResponse } from "next/server";
import { generateText } from "ai";
import { getEffectiveSession } from "@/lib/auth-utils";
import { getModel } from "@/lib/ai/providers";

export async function POST(request: Request) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { description, name } = await request.json();
  if (!description) {
    return NextResponse.json(
      { error: "Description required" },
      { status: 400 }
    );
  }

  try {
    const { text } = await generateText({
      model: getModel("gpt-4o-mini"),
      system:
        "You generate skill instructions for AI agents. Return ONLY the instructions text, no markdown headers or explanations.",
      prompt: `Generate skill instructions for an AI agent skill. The skill is: "${description}"${name ? ` called "${name}"` : ""}.

Write clear, actionable instructions that:
- Explain the reasoning behind each step (not rigid MUST/NEVER rules)
- Use numbered steps for the workflow
- Include guidance for edge cases
- Are concise but thorough (aim for 8-15 lines)
- Focus on behavioral instructions, not meta-commentary

Return ONLY the instructions text.`,
      maxTokens: 1000,
    });

    return NextResponse.json({ instructions: text.trim() });
  } catch {
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 }
    );
  }
}
