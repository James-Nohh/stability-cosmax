const ADMIN_URL = "https://stability-admin.stability-cosmax.workers.dev/admin";

// Power Automate "웹훅 요청을 받으면 채널에 게시" 워크플로로 Adaptive Card를 전송합니다.
export async function sendTeamsAlarm(webhookUrl: string, title: string, message: string) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "message",
      summary: title, // Teams 채팅 목록 미리보기(요약) 텍스트
      text: `**${title}**\n\n${message}`,
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
              {
                type: "TextBlock",
                id: "laterNote",
                text: "확인이 필요하시면 안정도 관리 화면에서 다시 확인해주세요.",
                wrap: true,
                isSubtle: true,
                isVisible: false,
              },
            ],
            actions: [
              { type: "Action.OpenUrl", title: "안정도 확인", url: ADMIN_URL },
              { type: "Action.ToggleVisibility", title: "나중에", targetElements: ["laterNote"] },
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
