const ADMIN_BASE = "https://stability-admin.stability-cosmax.workers.dev";

// Power Automate "웹훅 요청을 받으면 채널에 게시" 워크플로로 Adaptive Card를 전송합니다.
export async function sendTeamsAlarm(
  webhookUrl: string,
  title: string,
  message: string,
  scheduleId: number
) {
  const ackUrl = `${ADMIN_BASE}/ack/${scheduleId}`;
  const snoozeUrl = `${ADMIN_BASE}/snooze/${scheduleId}`;

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
                text: "버튼 클릭 시 알람 해제",
                wrap: true,
                isSubtle: true,
                size: "Small",
              },
            ],
            actions: [
              { type: "Action.OpenUrl", title: "안정도 확인", url: ackUrl },
              { type: "Action.OpenUrl", title: "나중에", url: snoozeUrl },
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
