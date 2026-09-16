// Power Automate "웹훅 요청을 받으면 채널에 게시" 워크플로로 Adaptive Card를 전송합니다.
export async function sendTeamsAlarm(webhookUrl: string, title: string, message: string) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "message",
      summary: title, // Teams 채팅 목록 미리보기(요약) 텍스트
      text: title,
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            type: "AdaptiveCard",
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            version: "1.4",
            body: [
              { type: "TextBlock", text: title, weight: "Bolder", size: "Medium", wrap: true },
              { type: "TextBlock", text: message, wrap: true },
            ],
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Teams webhook failed: ${res.status} ${body}`);
  }
}
