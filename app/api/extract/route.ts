import Anthropic from "@anthropic-ai/sdk";
import { extractWines } from "@/lib/extract";
import type { InputPart } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  let parts: InputPart[];
  try {
    const body = (await request.json()) as { parts?: InputPart[] };
    parts = Array.isArray(body.parts) ? body.parts : [];
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (parts.length === 0) {
    return Response.json({ error: "분석할 입력이 없습니다." }, { status: 400 });
  }

  try {
    return Response.json({ wines: await extractWines(parts) });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Claude API 키가 없거나 올바르지 않습니다." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Claude API 사용량 한도에 걸렸습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `Claude API 오류 (${error.status ?? "연결 실패"}): ${error.message}` }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
