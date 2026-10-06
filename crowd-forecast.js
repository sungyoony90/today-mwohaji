(function initializeCrowdForecast(global) {
  const SEOUL_TIME_ZONE = "Asia/Seoul";

  function seoulDateParts(date) {
    const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: SEOUL_TIME_ZONE,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value]));
    return { weekday: values.weekday, hour: Number(values.hour) };
  }

  function isPreferredTime(spot, hour) {
    if (spot.time === "night") return hour >= 18 && hour < 23;
    if (spot.time === "day") return hour >= 11 && hour < 18;
    return hour >= 11 && hour < 21;
  }

  function estimate(spot, date = new Date()) {
    if (!spot || !spot.id || !(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const { weekday, hour } = seoulDateParts(date);
    const weekend = weekday === "Sat" || weekday === "Sun";
    const preferredTime = isPreferredTime(spot, hour);
    const seasonal = Boolean(spot.seasonLabel);
    const reasons = [];
    let score = 0;

    if (weekend) { score += 1; reasons.push("주말 방문 수요"); }
    else reasons.push("평일 방문 수요");
    if (preferredTime) { score += 1; reasons.push(spot.time === "night" ? "저녁 추천 시간대" : "낮 추천 시간대"); }
    else reasons.push("주요 추천 시간대 밖");
    if (seasonal) { score += 1; reasons.push(spot.seasonLabel); }

    return {
      level: score >= 3 ? "붐빌 가능성 높음" : score === 2 ? "다소 붐빌 수 있음" : "비교적 여유 예상",
      reasons,
      basis: "요일·추천 시간대·검증된 계절/행사 정보",
      source: seasonal && spot.sourceUrl ? spot.sourceUrl : "catalog-metadata",
      estimatedAt: date.toISOString(),
      affectsRanking: false,
    };
  }

  function populationLabel(level) {
    return ({ 여유: "여유", 보통: "보통", "약간 붐빔": "약간 혼잡", 붐빔: "혼잡" })[level] || "확인 전";
  }

  global.CROWD_FORECAST = Object.freeze({ estimate, populationLabel });
})(window);
