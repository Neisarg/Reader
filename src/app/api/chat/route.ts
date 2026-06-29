import { NextRequest } from "next/server";
import { spawn } from "child_process";

export async function POST(request: NextRequest) {
  try {
    const { messages, paperContext } = await request.json();

    // Build the prompt — include paper context and conversation history
    let prompt = "";

    if (paperContext) {
      prompt += `You are Raven, a research paper reading assistant. The user is reading this paper:\n`;
      prompt += `Title: ${paperContext.title}\n`;
      prompt += `Authors: ${paperContext.authors}\n`;
      prompt += `Date: ${paperContext.date}\n`;
      prompt += `Abstract: ${paperContext.abstract}\n`;
      if (paperContext.publicationTitle) prompt += `Publication: ${paperContext.publicationTitle}\n`;
      prompt += `\nUse Markdown formatting. Be concise but thorough. Use LaTeX for math ($inline$, $$display$$). Structure answers with headings and bullet points when appropriate.\n\n`;
      if (paperContext.fullText) {
        // Truncate to ~80k chars to stay within context limits
        const text = paperContext.fullText.length > 80000
          ? paperContext.fullText.slice(0, 80000) + "\n\n[... truncated ...]"
          : paperContext.fullText;
        prompt += `--- FULL PAPER TEXT ---\n${text}\n--- END OF PAPER ---\n\n`;
      }
    }

    // Add conversation history
    for (const m of messages) {
      if (m.role === "user") {
        prompt += `User: ${m.content}\n\n`;
      } else {
        prompt += `Assistant: ${m.content}\n\n`;
      }
    }

    // Always send the full prompt with paper context
    const fullPrompt = prompt;

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        const proc = spawn("claude", ["-p", "--output-format", "stream-json", "--verbose"], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        // Send the prompt via stdin
        proc.stdin.write(fullPrompt);
        proc.stdin.end();

        let buffer = "";

        proc.stdout.on("data", (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === "assistant" && parsed.message?.content) {
                for (const block of parsed.message.content) {
                  if (block.type === "text" && block.text) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`)
                    );
                  }
                }
              } else if (parsed.type === "result") {
                // Final result — send any remaining text
                if (parsed.result) {
                  // Only send if we haven't been streaming
                }
              }
            } catch {
              // Not valid JSON, skip
            }
          }
        });

        proc.stderr.on("data", (data: Buffer) => {
          console.error("claude stderr:", data.toString());
        });

        proc.on("close", () => {
          // Process remaining buffer
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer);
              if (parsed.type === "assistant" && parsed.message?.content) {
                for (const block of parsed.message.content) {
                  if (block.type === "text" && block.text) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`)
                    );
                  }
                }
              }
            } catch {
              // ignore
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        });

        proc.on("error", (err) => {
          console.error("claude process error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: `Error: ${err.message}` })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        });
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 }
    );
  }
}
