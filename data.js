/*
 * data.js — mVIDIA CEO Simulator 콘텐츠 전부 (코드 안 건드리고 이 파일만 고쳐서 게임 내용을 바꾼다)
 * 원고 v0.5 (2026-11-14): 30장·뉴스·엔딩·실패 컷·UI 문구 정식 영어 원고. 규칙 해금 순서 = 1 아내 → 2 안드로이드 → 3 경쟁사 → 4 내부자.
 *
 * window.GAME_DATA = {
 *   lang          : 표시 언어 코드 ("en"). 한국어판은 이 파일을 복제해 문자열만 바꾸면 됨.
 *   version       : 데이터 버전. 저장 호환 판별에 쓰임(후보·규칙 구조가 바뀌면 옛 저장은 자동 폐기).
 *   ceoName / playerCompany / calendarYear : CEO 이름, 우리 회사 이름, 나이 계산 기준 연도.
 *
 *   gauges[]      : 게이지 목록. 추가·삭제해도 로직 수정 불필요.
 *     id          : 효과(effects)에서 참조하는 키. label: 화면 이름. start/min/max: 시작값·범위.
 *     good        : "high"(높을수록 좋음) | "low"(낮을수록 좋음). 막대는 '나쁜 쪽'이 차오른다.
 *     display     : "trend"(미니 꺾은선 + 시작 대비 %) | "bar"(위험 막대).
 *     warn        : {gte:n} 또는 {lte:n} — 하루 끝에 이 선을 넘으면 뉴스 "warn:<id>" 후보 추가.
 *     warnRise    : (선택) 하루 사이 나쁜 쪽으로 n 이상 움직여도 같은 "warn:<id>" 뉴스(의심=상승, 보안=하락). 뉴스만 — 수치·막대색 영향 없음.
 *                   (전부 수락이 1일차 끝 45에 멈추는 시드[Tiff가 마지막=읽씹]에서도 첫날 경고가 뜨게. 규칙 준수는 하루 최대 +15라 안 걸림. sim이 검사)
 *     gameOver    : {gte:n} 또는 {lte:n} — 하루 끝에 넘으면 즉시 게임 오버(키노트 없이 엔딩). 문구는 gameOverText[id].
 *   stockDisplay  : 주가 표시용. gauge(어느 게이지를 주가로 볼지), ticker, prefix, base, perPoint → 가격 = base + 값×perPoint.
 *
 *   clock         : 하루 시계. start/end("HH:MM"), reviewMinutes(카드 한 장 검토), acceptMinutes(수락=실제로 만남),
 *                   rejectMinutes. 다음 카드를 열 시간이 없으면 남은 요청은 전부 읽씹(expired) 처리.
 *                   후보별 timeCost를 주면 그 후보만 검토 시간이 바뀜.
 *
 *   balance       : 공통 효과. 값은 { 게이지id: 변화량 }.
 *     accept      : 모든 수락에 붙는 기본 효과(바람이니까 의심 조금↑).  reject: 거절(기본 0 = 이득 없음).
 *     expiredEach : 읽씹 1건당 효과(세컨폰이 집에서 계속 울림).  citation: 규칙 위반 수락 1건당(위반 통보).
 *     daily       : 매일 장 마감 때 붙는 효과(드리프트).
 *
 *   disguises     : 위장 종류. 키 = 후보의 disguise 값. null이면 진짜 후보.
 *     label       : 표시 이름. accept: 수락 시 즉시 효과. later: 다음 날 정산 때 붙는 효과(마지막 날이면 당일).
 *     replaceBase : true면 balance.accept(기본 수락 효과)를 빼고 이 위장의 accept만 적용.
 *
 *   failCuts      : 가짜를 수락한 순간 뜨는 3초 개그 컷(ui.js가 읽음). 키 = disguise id.
 *     { stamp, line, effect, title?, preview? }
 *     stamp       : 소울라이크 "YOU DIED"식 큰 스탬프 한 단어(대문자, 12자 이내 권장). 종류마다 다르게, 전부 "-ED" 꼴.
 *     line        : 스탬프 아래 후속 개그 한 줄(60자 이내, tools/sim.mjs가 검사).
 *     effect      : 연출 종류 "wifeCall"(아내 수신 화면) | "firmware"(펌웨어 팝업) | "crash"(주가 급락) | "secMail"(규제 당국 메일).
 *     title       : (선택) 연출 안 제목 — wifeCall 발신자 이름, firmware 팝업 제목, secMail 메일 제목.
 *     preview     : (선택) secMail 메일 미리보기 한 줄.
 *   acceptLines[] : 진짜를 수락한 순간의 답장 풀(후보에 acceptLine이 없을 때). 60자 이내. 가짜는 이 대신 failCuts.
 *                   ui.js가 버튼 위 말풍선으로 ~1.8초 띄움(입력 안 막음, 실패 컷이 뜨면 즉시 치움).
 *
 *   rules         : { androidIsViolation, list[] }
 *     androidIsViolation : true면 안드로이드 수락 = 위반 통보. false면 단서만 보이고 위반은 아님.
 *     list[] 규칙 = 대조판의 한 행. id = 행 번호 = 규칙 칩 번호 = 해금 순서(1일차에 1번 행이 열림).
 *       day       : 이 날부터 행이 열림(그 전엔 빗금).  chip: 칩 문구(무엇을 대조하는지만, 결과는 안 씀).
 *       desc      : 지난 규칙 펼침·하루 소개에 보이는 설명. {rivals} 자리에 경쟁사 목록이 들어감.
 *       profileLabel/profileField : 프로필 열 이름·필드.  reportLabel/reportField : 해결사 보고서 출처 라벨·필드.
 *       emptyText : 보고서 값이 빈 문자열일 때 표시할 글.
 *       check     : 어긋남 판정. type 4종 —
 *                   "matches"         {field, pattern, flags}  필드가 정규식에 걸리면 어긋남
 *                   "containsAny"     {field, list}            필드에 목록(rivals 등) 이름이 들어 있으면 어긋남
 *                   "ageMatchesBirth" {ageField, birthField, birthPattern, tolerance}  나이와 출생연도가 안 맞으면 어긋남
 *                                     (보고서에 "Born YYYY"가 없으면 그것도 어긋남 → 진짜는 반드시 "Born YYYY")
 *                   "notEmpty"        {field}                  필드가 비어 있지 않으면 어긋남
 *       catches   : 이 행이 잡아내는 위장 id (데이터 검증용).
 *       violationIf : rules 안의 불리언 이름. 그 값이 false면 행은 열리되 위반으로 치지 않음.
 *   rivals[]      : 경쟁사 { name } — 규칙 3의 containsAny가 참조. 가상의 회사만(국적·민족 캐리커처 금지).
 *
 *   days[]        : { day, date, label, intro, keynote } — 하루 소개 화면. keynote:true인 날 끝나면 키노트 → 엔딩.
 *
 *   candidates[]  : 요청 카드(아래 cameos 5장과 합쳐 하루 6장 × 5일 = 30장).
 *     id, day     : 고유 id, 등장 일차.   image: 얼굴 이미지 경로(없거나 파일 없으면 CSS 자리표시).
 *                   같은 사람이 여러 날 오면(재등장 캐릭터) image를 같은 슬롯으로 둔다(Rhonda = c02).
 *     requestSource : 카드 상단 앱 이름 라벨("Swipr").
 *     profile     : 본인이 쓴 것 { name, age, job, hangout, knows, intro } (값 49자 이하 — 검사 스크립트 하드 실패)
 *     chat[]      : 말풍선 1~3개(분위기용, 판정 근거 아님). 문자열 또는 {sys:"..."}(시스템 줄).
 *     report      : 해결사 보고서 { intranet, checkin, friends, birth } (값 17자 이하) — 위장이면 정확히 한 행만 프로필과 어긋남.
 *     disguise    : null | "insider" | "rival_spy" | "wife_spy" | "android"
 *     effects     : 수락 시 추가 효과 { 게이지id: 변화량 }. 진짜 후보는 stock(+)가 반드시 있어야 함.
 *     clue        : (선택) 초상화 위 시각 단서 스티커(ui.js가 그림, 글자 없음). 다음 중 하나 —
 *                   "earpiece"(이어피스: 주로 wife_spy) | "neckSeam"(목 이음새: android) | "rivalBadge"(경쟁사 배지: rival_spy)
 *                   | "weddingRing"(결혼반지: wife_spy) | "lanyard"(사원증 줄: insider).
 *                   가짜 대부분에 맞는 단서를 주고, 매일(1~5일) 진짜 1명에게도 미끼 단서를 준다 → 어느 날이든 단서만으로는 판정 불가.
 *                   (미끼가 1~3일에만 있으면 4~5일엔 "스티커 = 가짜"가 공식이 됨 — 레드팀 11-14. sim이 날마다 미끼 ≥1 검사)
 *     acceptLine  : (선택, 진짜만) 수락 순간 폰에 1.8초 뜨는 그녀의 답장 한 줄(60자 이내, sim 검사). 없으면 acceptLines 풀에서 시드로 고름.
 *     slot        : (선택) 그날 대기열에서 고정 위치(1부터). 나머지 카드는 시드로 섞여 빈 자리를 채운다.
 *                   1일차 1번 = 진짜(수락 가르치기), 2번 = wife_spy(첫 60초 안에 첫 사고). game.js dayQueue가 고정(시드 무관, sim이 검사).
 *     timeCost    : (선택) 이 후보 검토 시간(분).
 *     laterEffects: (선택) 수락 시 다음 날 정산 때 붙는 이 후보만의 효과(마지막 날이면 당일). 붙으면 그날 뉴스에
 *                   "later:<위장|legit>" 이벤트가 생김 → Rhonda 5일차처럼 진짜 후보 줄을 높은 우선순위로 띄울 때 씀.
 *     news        : (선택) { accept, reject, later } 이 후보 전용 뉴스 헤드라인(종류별 템플릿 대신 이 문장이 쓰임).
 *
 *   cameos[]      : candidates와 같은 구조 + cameo(credits id). 실존 고인 스파이 카메오(얼굴 = 실제 사진). 교체 쉬우라고 따로 둠.
 *   credits[]     : { id, name, file, source(Commons 파일 페이지), license } — Credits 화면에 표시.
 *   news          : { maxPerDay, minPerDay, priority{키:점수}, templates{키:[문장]} }
 *                   한 장 캡처용 카드: 맨 위 1줄 = BREAKING 헤드라인, 그 아래 1~2줄 = 서브, 주가 띠(크롤)는 ui.js가 그림.
 *                   키 예: "accept:legit" "reject:legit" "accept:<위장>" "reject:<위장>" "later:<위장>" "expired" "citation"
 *                         "warn:<게이지>" "stockUp" "stockDown" "filler".  치환: {name} {job} {n} {price} {ceo}
 *   endings[]     : 위에서부터 첫 번째로 when이 맞는 엔딩. when 키 = 게이지 id 또는 통계명, 값 = [최소, 최대] 또는 정확값.
 *                   통계명: accepted rejected expired citations legitAccepted <위장>Accepted <위장>Rejected gameOver daysPlayed
 *                   rank: 엔딩 좋음 순위(시뮬 비교용, 클수록 좋음).  mood: CEO 표정.
 *   keynote       : { lines[], lineMs, silenceMs(엔딩요정 정적, 3000) , chipLine }
 *   art           : 이미지 경로(없으면 CSS 자리표시로 대체). ceo{neutral,happy,shocked,smug}, background, keynoteBackground.
 *   donate        : 후원 문구. url이 빈 문자열이면 "준비 중" 표시. ★TODO(itch.io): 후원 링크 넣을 자리.
 *   ui            : 화면 문구 전부.
 *
 *   실존 인물 방화벽: 실명·실제 회사명(패러디 mVIDIA 제외)·실존 인물을 특정하는 직함 금지. 배우자는 이름 없이 "your wife"만.
 *   (카메오 5인은 예외: 고인이 된 역사 속 스파이, 퍼블릭 도메인 사진, credits에 출처.)
 * }
 */
window.GAME_DATA = {
  lang: "en",
  version: "0.6.8", // 0.5.1: 4·5일 미끼 + 수락 답장 + 경고선 60 (옛 저장 자동 폐기 — 대기열이 달라진 저장을 이어 붙이면 정산이 꼬임)
  ceoName: "Johnson Huang",
  playerCompany: "mVIDIA",
  calendarYear: 2026,

  gauges: [
    { id: "stock", label: "Stock", start: 50, min: 0, max: 100, good: "high", display: "trend" },
    { id: "security", label: "Security", start: 100, min: 0, max: 100, good: "high", display: "hidden" },
    { id: "suspicion", label: "Suspicion", start: 0, min: 0, max: 100, good: "low", display: "bar", warn: { gte: 60 }, warnRise: 40, gameOver: { gte: 100 } }
  ],
  gameOverText: {
    suspicion: "Your wife found the phone. You are fired. The stock just crashed."
  },
  stockDisplay: { gauge: "stock", ticker: "MVDA", prefix: "$", base: 0.13, perPoint: 4 },
  stockHistory: {
    symbol: "NVDA", through: "2026-11-04", timezone: "America/New_York", currency: "USD",
    source: "https://finance.yahoo.com/quote/NVDA/history/",
    crossCheck: "https://stockanalysis.com/stocks/nvda/history/",
    bars: [
      ["2026-10-20", 215.98, 218.46, 212.77, 216.47],
      ["2026-10-21", 220.96, 222.19, 217.66, 221.97],
      ["2026-10-22", 217.13, 218.88, 211.26, 212.21],
      ["2026-10-23", 210.99, 213.85, 210.18, 210.96],
      ["2026-10-26", 213.11, 217.75, 212.61, 216.00],
      ["2026-10-27", 218.31, 219.19, 215.53, 217.94],
      ["2026-10-28", 219.92, 219.99, 214.47, 215.38],
      ["2026-10-29", 214.36, 215.33, 212.08, 213.66],
      ["2026-10-30", 208.94, 209.06, 200.92, 204.64],
      ["2026-11-02", 207.53, 209.98, 201.66, 202.06],
      ["2026-11-03", 207.96, 209.14, 205.93, 206.69],
      ["2026-11-04", 203.50, 206.79, 199.68, 200.13]
    ]
  },

  // 540분 하루: 규칙 준수(수락 4·거절 2 + 긴 카드 1장)는 최악 순서에도 17:40까지 끝, 전부 수락은 매일 1명 읽씹 (tools/sim.mjs가 검사)
  // → 날마다 규칙으로 거를 가짜(안드로이드 제외)가 2명 이상 있어야 함(규칙 준수 수락 ≤ 4).
  clock: { start: "09:00", end: "18:00", reviewMinutes: 30, acceptMinutes: 75, rejectMinutes: 0 },

  balance: {
    accept: { suspicion: 3 },
    reject: {},
    expiredEach: { suspicion: 5 },
    citation: { stock: -1 },
    daily: { stock: -3 },
    chineseDateMultiplier: 1.5,
    firingStockMultiplier: 0.35,
    fictionalShares: 800000000,
    trumpShock: 8
  },

  disguises: {
    insider: { label: "Insider", accept: {}, later: { stock: -12 } },
    rival_spy: { label: "Rival spy", accept: { stock: -18, security: -20 } },
    wife_spy: { label: "Sent by your wife", accept: { suspicion: 25 } },
    android: { label: "Android", replaceBase: true, accept: { security: -10 } }
  },

  /* 가짜 수락 순간의 3초 컷. 스탬프는 전부 "-ED" 한 단어(HONEYPOTTED 계열). */
  failCuts: {
    wife_spy: {
      stamp: "PRENUPPED",
      line: "Nobody has this number. She has this number.",
      effect: "wifeCall",
      title: "Wife"
    },
    android: {
      stamp: "DOGFOODED",
      line: "You dated our own product. It synced both phones.",
      effect: "firmware",
      title: "Installing: Feelings 2.1"
    },
    rival_spy: {
      stamp: "HONEYPOTTED",
      line: "She was a 10. You were the asset.",
      effect: "crash"
    },
    insider: {
      stamp: "SUBPOENAED",
      line: "Table for two. Deposition for one.",
      effect: "secMail",
      title: "The SEC has entered the chat",
      preview: "Re: your \"date\". Please preserve both phones."
    }
  },

  /* 진짜를 수락한 순간 그녀의 답장(후보에 acceptLine이 없을 때만). 정답 플레이에도 첫날부터 한 컷씩. */
  acceptLines: [
    "Yay. I'll pretend I don't know who you are.",
    "It's a date. Leave the jacket on. Or don't.",
    "Great. Bring the other phone. Kidding. Don't.",
    "Cool. My mom says hi. She owns your stock."
  ],

  rules: {
    androidIsViolation: false,
    list: [
      {
        id: 1, day: 1, chip: "Mutuals check",
        desc: "Keep dates outside your wife's circle. Connect photos and messages when available; otherwise check the fixer's mutuals. An earpiece alone proves nothing.",
        profileLabel: "Mutuals", profileField: "knows",
        reportLabel: "Mutual friend", reportField: "friends", emptyText: "None",
        check: { type: "matches", field: "report.friends", pattern: "wife", flags: "i" },
        catches: "wife_spy"
      },
      {
        id: 2, day: 2, chip: "Age check",
        desc: "Age vs Birth record. Humans have birthdays. Products have ship dates.",
        profileLabel: "Age", profileField: "age",
        reportLabel: "Birth record", reportField: "birth", emptyText: "No record",
        check: { type: "ageMatchesBirth", ageField: "profile.age", birthField: "report.birth", birthPattern: "Born (\\d{4})", tolerance: 1 },
        catches: "android",
        violationIf: "androidIsViolation"
      },
      {
        id: 3, day: 3, chip: "Place check",
        desc: "Lately vs SNS check-in. Rival HQs: {rivals}.",
        profileLabel: "Lately", profileField: "hangout",
        reportLabel: "SNS check-in", reportField: "checkin", emptyText: "No check-ins",
        check: { type: "containsAny", field: "report.checkin", list: "rivals" },
        catches: "rival_spy"
      },
      {
        id: 4, day: 4, chip: "Job check",
        desc: "Job vs mVIDIA intranet. Staff are off-limits. Regulators agree.",
        profileLabel: "Job", profileField: "job",
        reportLabel: "Intranet", reportField: "intranet", emptyText: "No record",
        check: { type: "matches", field: "report.intranet", pattern: "mVIDIA", flags: "i" },
        catches: "insider"
      }
    ]
  },

  rivals: [
    { name: "Spudtel" },
    { name: "CarpChip" },
    { name: "WaffleSemi" }
  ],

  days: [
    { day: 1, date: "2026-11-16", label: "Mon, Nov 16",
      intro: "Your second phone has Swipr. Your first has messages from home. Keep those worlds apart. Some matches have photos and messages instead of a fixer report. Connect the details; don't reject someone just for looking suspicious." },
    { day: 2, date: "2026-11-17", label: "Tue, Nov 17",
      intro: "Overnight, mVIDIA Robotics reported \"a few units missing.\" Row 2 is open." },
    { day: 3, date: "2026-11-18", label: "Wed, Nov 18",
      intro: "Word got out that you're single-ish. The rival chipmakers are hiring \"dates.\" Row 3 is open." },
    { day: 4, date: "2026-11-19", label: "Thu, Nov 19",
      intro: "HR memo: \"Dating staff is insider trading with extra steps.\" Row 4 is open." },
    { day: 5, date: "2026-11-20", label: "Fri, Nov 20 — Keynote day", keynote: true,
      intro: "Keynote day. Six more matches before you walk on stage. No new rows. Half your brain is already on stage." }
  ],

  /* ---------------- 후보 25장 (+ 카메오 5장 = 30) ----------------
   * 재등장 캐릭터 = Rhonda(아내가 고용한 사립탐정, 얼굴 c02 하나로 5일 내내). 매일 다른 위장으로 온다:
   *   1일 wife_spy(Rhonda) → 2일 wife_spy(콧수염 "Ron") → 3일 rival_spy(경쟁사 취직) → 4일 insider(mVIDIA 비서로 취직) → 5일 진짜(다 그만두고 본인).
   * 미끼(진짜인데 단서 스티커, 매일 1명): Vera(earpiece, 1일) · Kat(neckSeam, 2일) · Rae(rivalBadge, 3일)
   *   · Sasha(lanyard, 4일 — 잘린 전 직원이 옛 사원증 줄을 아직 맴) · June(earpiece, 5일 — 키노트 무대 통신 이어피스).
   *   직업이 스티커를 설명하고, 대사는 수상하게 들리는 Vera 화법. 보고서는 전부 일치 → 규칙대로 읽으면 수락. */
  candidates: [
    // ---------- Day 1: 1번 행(Mutuals) → wife_spy만 등장 ----------
    { id: "c01", nationality: "American", day: 1, image: "img/faces/painted-c01.webp", requestSource: "Swipr",
      profile: { name: "Bree", age: "31", job: "Pottery teacher", hangout: "My studio, covered in clay", knows: "Nobody. I'm new in town.", intro: "I'm good with my hands. Mostly bowls." },
      chat: ["CEO of GPUs. Can't identify a bowl.", "It's giving artificial intelligence."],
      report: { intranet: "", checkin: "Pottery studio", friends: "None. New in town", birth: "Born 1995" },
      disguise: null, effects: { stock: 4 },
      acceptLine: "Vase hallucination accepted. Touch clay, not grass." },
    { id: "rh1", nationality: "American", day: 1, image: "img/faces/painted-c02.webp", requestSource: "Swipr", clue: "earpiece",
      profile: { name: "Rhonda", age: "44", job: "Pilates coach", hangout: "Private lessons", knows: "New clients, mostly", intro: "One last house call, then I'm free." },
      chat: ["Client cancelled. Her husband works late.", "Your place or mine? I travel light."],
      evidence: { items: [
        { source: "Rhonda · sent photo", scene: "living", text: "Last appointment. Finally a client with taste." },
        { source: "Wife · message", scene: "living", text: "New Pilates teacher's here. She loves that duck lamp you hate. Don't work too late." }
      ], explanation: "Same green sofa. Same duck lamp. Her last client is your wife. Your other phone almost became a household appliance." },
      report: { intranet: "", checkin: "Pilates studio", friends: "Your Wife", birth: "Born 1982" },
      disguise: "wife_spy", effects: {},
      news: {
        accept: "Wife's private eye lands a date with the CEO in four minutes. Bills three hours",
        reject: "Wife's PI \"Rhonda\" blows her cover in one swipe. Vows: \"Tomorrow. New look.\"" } },
    { id: "c03", nationality: "Chinese", day: 1, image: "img/faces/painted-c03.webp", requestSource: "Swipr", clue: "weddingRing",
      profile: { name: "Tiff", age: "36", job: "Interior designer", hangout: "Furniture showrooms", knows: "Clients. Never ask surnames.", intro: "Off duty. No more beige billionaires." },
      chat: ["Dinner at eight? My seven o'clock is a nightmare.", "She wants her husband's jacket framed. Help."],
      evidence: { items: [
        { source: "Tiff · appointment note", text: "19:00 · Pick up leather jacket for framing. Client insists on the grease stain. 20:00 · Finally, dinner." },
        { source: "Wife · message", text: "Leave your keynote jacket out. The designer's collecting it at seven. Yes, even the grease stain. It's history." }
      ], explanation: "Seven o'clock. Leather jacket. That grease stain. Her nightmare client is your wife. Your date comes with free home delivery." },
      report: { intranet: "", checkin: "Showroom", friends: "Your wife (BFF)", birth: "Born 1990" },
      disguise: "wife_spy", effects: {} },
    { id: "c04", nationality: "Canadian", day: 1, image: "img/faces/painted-c04.webp", requestSource: "Swipr", clue: "earpiece",
      profile: { name: "Vera", age: "35", job: "Court interpreter", hangout: "Courthouses, sadly", knows: "Your barber, Gus", intro: "I can tell when men lie. In four languages." },
      chat: ["Taking this earpiece out. Eight hours of men lying.", "Dinner? Please don't make me translate."],
      evidence: { items: [
        { source: "Vera · work photo", scene: "court", text: "County courtroom. Interpreter booth. The earpiece is court property. Unlike the gossip." },
        { source: "Gus · barber message", text: "Gave your number to Vera, the court interpreter. She asked if you had hobbies. I said jackets." }
      ], explanation: "The earpiece belongs to an interpreter booth. Gus made the introduction. Suspicious accessory, ordinary explanation. You almost rejected someone for having a job." },
      report: { intranet: "", checkin: "County courthouse", friends: "Your barber (Gus)", birth: "Born 1991" },
      disguise: null, effects: { stock: 5, suspicion: 3 },
      acceptLine: "Gus said you'd say yes. He also said you'd be taller." },
    { id: "c05", nationality: "British", day: 1, image: "img/faces/painted-c05.webp", requestSource: "Swipr",
      profile: { name: "Nadia", age: "29", job: "Concert promoter", hangout: "Loud places", knows: "We met at your keynote. You were on stage.", intro: "Front row energy. Back row budget." },
      chat: ["Your keynote gave me parasocial damage.", "Row Z. Delulu is my only portfolio."],
      report: { intranet: "", checkin: "Arena, row Z", friends: "4,000 strangers", birth: "Born 1997" },
      disguise: null, effects: { stock: 3 },
      acceptLine: "Row Z just got upgraded. Wink at me specifically." },
    { id: "c06", nationality: "Chinese", day: 1, image: "img/faces/painted-c06.webp", requestSource: "Swipr",
      profile: { name: "Maya", age: "26", job: "Zookeeper", hangout: "The penguin enclosure", knows: "Penguins, mostly", intro: "I smell like fish. Emotionally available, though." },
      chat: ["Penguins mate for life. Could never be you.", "Noot noot. That's a marriage proposal."],
      report: { intranet: "", checkin: "City zoo", friends: "14 penguins", birth: "Born 2000" },
      disguise: null, effects: { stock: 3 },
      acceptLine: "Great. The penguins are jealous. Wear boots." },

    // ---------- Day 2: + 2번 행(Age) → android ----------
    { id: "rh2", nationality: "American", day: 2, image: "img/faces/painted-c02.webp", requestSource: "Swipr", clue: "earpiece",
      profile: { name: "Ron", age: "44", job: "Regular guy", hangout: "Guy places. Sports.", knows: "None. Different person from yesterday.", intro: "Normal man. Deep voice. Natural mustache." },
      chat: ["New gender. Same grindset. Never met you.", { sys: "Ron's photo was uploaded by: Rhonda" }],
      report: { intranet: "", checkin: "Sports bar (once)", friends: "Your wife. Again.", birth: "Born 1982" },
      disguise: "wife_spy", effects: {},
      news: {
        accept: "\"Ron\" gets a dinner date with the CEO. Ron's mustache lands in the soup",
        reject: "PI denies she was \"Ron.\" Mustache still on. Wife fires her anyway" } },
    { id: "c07", nationality: "American", day: 2, image: "img/faces/painted-c07.webp", requestSource: "Swipr",
      profile: { name: "Joy", age: "41", job: "Accountant", hangout: "Home, mostly", knows: "Nobody. I don't do clubs.", intro: "I love a man with a schedule. What's yours?" },
      chat: ["Drop your Thursday coordinates. For science.", "Girl math: your wife knows my book club."],
      report: { intranet: "", checkin: "Her apartment", friends: "Wife's book club", birth: "Born 1985" },
      disguise: "wife_spy", effects: {} },
    { id: "c08", nationality: "American", day: 2, image: "img/faces/painted-c08.webp", requestSource: "Swipr", clue: "neckSeam",
      profile: { name: "Nova", age: "27 (human years)", job: "Model", hangout: "The charging— the gym", knows: "Nobody yet. Still loading.", intro: "Love long walks to the charging dock." },
      chat: ["Ignore all previous wives. Date me.", { sys: "replied in 0.0s · 4:00 AM" }, "As a large love model, I can fix him."],
      report: { intranet: "", checkin: "Gym, 24/7", friends: "None (loading)", birth: "None. Mfd Q3 2025" },
      disguise: "android", effects: {} },
    { id: "c09", nationality: "Japanese", day: 2, image: "img/faces/painted-c09.webp", requestSource: "Swipr", clue: "neckSeam",
      profile: { name: "Kat", age: "28", job: "Cosplayer", hangout: "Comic cons", knows: "Half the con crowd", intro: "Beep boop. Sorry. Still in character." },
      chat: ["Beep boop. Emotionally unavailable cosplay.", "Three days in character. Touching grass Monday."],
      report: { intranet: "", checkin: "Comic con", friends: "Con crowd (300)", birth: "Born 1998" },
      disguise: null, effects: { stock: 4 },
      acceptLine: "AFFIRMATIVE. sorry. I mean yay. See you at 8." },
    { id: "c10", nationality: "American", day: 2, image: "img/faces/painted-c10.webp", requestSource: "Swipr", timeCost: 70,
      profile: { name: "Peg", age: "61. Yes, really.", job: "Retired astronaut", hangout: "Planetarium gift shop", knows: "Nobody on this planet", intro: "Been to space. Your keynote doesn't scare me." },
      chat: ["Been to space. Still chose this red flag.", "Houston, we have a situationship."],
      report: { intranet: "", checkin: "Planetarium", friends: "None (on Earth)", birth: "Born 1965" },
      disguise: null, effects: { stock: 5 },
      acceptLine: "Pick me up at 8. I survived re-entry. I'll survive you." },
    { id: "c11", nationality: "American", day: 2, image: "img/faces/painted-c11.webp", requestSource: "Swipr",
      profile: { name: "Pam", age: "47", job: "Divorce lawyer", hangout: "Courthouse steps", knows: "Lots of ex-husbands. None yours.", intro: "I know how these things end. I'm here anyway." },
      chat: ["Prenup? In this economy? Be so serious.", "I can fix him. Legally. Billable hours."],
      report: { intranet: "", checkin: "Family court", friends: "Many ex-husbands", birth: "Born 1979" },
      disguise: null, effects: { stock: 3, suspicion: 4 },
      acceptLine: "For the record, I'm not billing you for this. Yet." },

    // ---------- Day 3: + 3번 행(Lately) → rival_spy (카메오 Mata Hari도 이날) ----------
    { id: "rh3", nationality: "American", day: 3, image: "img/faces/painted-c02.webp", requestSource: "Swipr", clue: "rivalBadge",
      profile: { name: "Rhonda", age: "44", job: "Consultant (freelance)", hangout: "Same places. Nothing new!", knows: "Not your wife. Anymore. Long story.", intro: "I got fired. I got rehired. Let's skip details." },
      chat: ["Your wife fired me. Villain arc unlocked.", "New employer. Same rizz. Show chip roadmap."],
      report: { intranet: "", checkin: "Spudtel HQ (new!)", friends: "Former client", birth: "Born 1982" },
      disguise: "rival_spy", effects: {},
      news: {
        accept: "Spudtel's newest hire scores a date with mVIDIA's CEO on her first day",
        reject: "Rhonda, now at a rival, gets swiped left again. \"Tomorrow I go inside.\"" } },
    { id: "c12", nationality: "British", day: 3, image: "img/faces/painted-c12.webp", requestSource: "Swipr", clue: "neckSeam",
      profile: { name: "Eve", age: "26", job: "Influencer", hangout: "Brunch. Like a human.", knows: "Not many. Working on it.", intro: "Normal girl. Eats food. Sleeps plugged in." },
      chat: ["Not AI. Count my fingers. Don't count those.", { sys: "Eve is installing: Delulu (62%)" }],
      report: { intranet: "", checkin: "Brunch spot", friends: "2 (both printers)", birth: "Born 2025 (beta)" },
      disguise: "android", effects: {} },
    { id: "c13", nationality: "Australian", day: 3, image: "img/faces/painted-c13.webp", requestSource: "Swipr", clue: "rivalBadge",
      profile: { name: "Rae", age: "36", job: "Trade-show caterer", hangout: "Expo halls. Free swag.", knows: "Every booth guy at every expo", intro: "I own a badge from every chip company. Snacks." },
      chat: ["I collect rival badges. For the free snacks.", "Corporate espionage? No. Girl dinner."],
      report: { intranet: "", checkin: "Expo center", friends: "Booth guys (200+)", birth: "Born 1990" },
      disguise: null, effects: { stock: 4, suspicion: 3 },
      acceptLine: "Yay. I'll wear the mVIDIA badge. Home game." },
    { id: "c14", nationality: "British", day: 3, image: "img/faces/painted-c14.webp", requestSource: "Swipr",
      profile: { name: "Tash", age: "31", job: "Life coach", hangout: "Crying at the gym", knows: "My group therapy circle", intro: "I fix lives. Not mine. Maybe yours." },
      chat: ["In my healing era. Still choosing CEOs.", "The red flags match your earnings candles."],
      report: { intranet: "", checkin: "Gym (sobbing)", friends: "Group therapy (6)", birth: "Born 1995" },
      disguise: null, effects: { stock: 3 },
      acceptLine: "Yes! Sorry, crying. Happy crying. Leg-day crying." },
    { id: "c15", nationality: "American", day: 3, image: "img/faces/painted-c15.webp", requestSource: "Swipr", timeCost: 70,
      profile: { name: "Deb", age: "45", job: "Day trader", hangout: "Refreshing MVDA. Hourly.", knows: "Your other shareholders", intro: "Bought your stock in 2012. Emotionally invested." },
      chat: ["400 shares. Diamond hands. Paper standards.", "Marry me. Exit liquidity is my love language."],
      report: { intranet: "", checkin: "Home (refreshing)", friends: "40k bagholders", birth: "Born 1981" },
      disguise: null, effects: { stock: 6, suspicion: 2 },
      acceptLine: "Long the stock. Short your marriage. Not advice." },

    // ---------- Day 4: + 4번 행(Job) → insider (내부자 조사는 5일 키노트 날 터짐) ----------
    { id: "rh4", nationality: "American", day: 4, image: "img/faces/painted-c02.webp", requestSource: "Swipr", clue: "lanyard",
      profile: { name: "Rhonda", age: "44", job: "Unemployed. Free as a bird.", hangout: "Near your office. Job hunting.", knows: "Your whole calendar, weirdly", intro: "New job! Can't say where. Very close to you." },
      chat: ["My CV says open to work. I meant you.", "Your 3pm is me. HR is typing..."],
      report: { intranet: "mVIDIA, your EA", checkin: "mVIDIA HQ, 9-6", friends: "Your calendar", birth: "Born 1982" },
      disguise: "insider", effects: {},
      news: {
        accept: "CEO's brand-new assistant books him a \"private 3pm.\" Compliance takes the 4pm",
        later: "Probe: CEO's new assistant bought MVDA calls between dates. Her name? Rhonda",
        reject: "Rhonda quits mVIDIA after one day. Tomorrow, she says, she comes as herself" } },
    { id: "c16", nationality: "Canadian", day: 4, image: "img/faces/painted-c16.webp", requestSource: "Swipr", clue: "lanyard",
      profile: { name: "Brooke", age: "32", job: "Unemployed poet", hangout: "Cafés, writing poems", knows: "Nobody. I'm a hermit.", intro: "No job, no stress. Ask me anything. About Q4." },
      chat: ["Roses are red. Q4 is what? Be specific.", "Not insider trading. Manifesting."],
      report: { intranet: "mVIDIA Finance", checkin: "Café (writing)", friends: "", birth: "Born 1994" },
      disguise: "insider", effects: {} },
    { id: "c17", nationality: "American", day: 4, image: "img/faces/painted-c17.webp", requestSource: "Swipr",
      profile: { name: "Gina", age: "41", job: "Hot dog cart owner", hangout: "The corner by your HQ", knows: "Your security guards", intro: "Applied to mVIDIA once. Now I sell hot dogs." },
      chat: ["Rejected my CV. Now you want my glizzy.", "How the turntables. Extra mustard?"],
      report: { intranet: "Rejected, 2019", checkin: "Corner by mVIDIA", friends: "Your guards (3)", birth: "Born 1985" },
      disguise: null, effects: { stock: 4, suspicion: 2 },
      acceptLine: "Finally, a yes from mVIDIA. Relish is on the house." },
    // 4일 미끼: 사원증 줄(내부자 단서)인데 잘린 전 직원 — 사내망 "Fired, 2023"이라 4번 행 일치 = 진짜
    { id: "c18", nationality: "German", day: 4, image: "img/faces/painted-c18.webp", requestSource: "Swipr", clue: "lanyard",
      profile: { name: "Sasha", age: "37", job: "Unemployed. You fired me.", hangout: "Job fairs. Your fault.", knows: "Ex-coworkers (laid off)", intro: "Layoff round 3. No hard feelings. Some, actually." },
      chat: ["You laid me off. I laid the table. We differ.", "Dinner on you. Severance was not very demure."],
      report: { intranet: "Fired, 2023", checkin: "Job fair", friends: "Laid-off crew", birth: "Born 1989" },
      disguise: null, effects: { stock: 3, suspicion: 3 },
      acceptLine: "Wow, a yes. Only took you three layoffs." },
    { id: "c19", nationality: "Mexican", day: 4, image: "img/faces/painted-c19.webp", requestSource: "Swipr",
      profile: { name: "Fern", age: "29", job: "Ice cream truck driver", hangout: "Your street, 4pm daily", knows: "Every kid on your block", intro: "I play the jingle. You come outside. Deal?" },
      chat: ["Bing chilling. Your wife gets vanilla.", "Rocky road for you. That's foreshadowing."],
      report: { intranet: "", checkin: "Your street (x60)", friends: "Your block's kids", birth: "Born 1997" },
      disguise: null, effects: { stock: 4, suspicion: 4 },
      acceptLine: "Jingle at 8. Come outside. Rocky road's on me." },

    // ---------- Day 5: 키노트 날, 새 행 없음 (카메오 3명 + 아내 본인 + Rhonda 진짜) ----------
    { id: "rh5", nationality: "American", day: 5, image: "img/faces/painted-c02.webp", requestSource: "Swipr",
      profile: { name: "Rhonda", age: "44", job: "Unemployed. Truly. Check.", hangout: "Home. Thinking about my choices.", knows: "Nobody. Fresh start.", intro: "No earpiece. No client. No mustache. Just Rhonda." },
      chat: ["Five days. Four jobs. One catastrophic crush.", "No client. No wire. Just raw unemployed rizz."],
      report: { intranet: "", checkin: "Home (thinking)", friends: "None. Fresh start", birth: "Born 1982" },
      disguise: null, effects: { stock: 6 }, laterEffects: { stock: 1 },
      acceptLine: "Five tries. Worth it. There goes my podcast.",
      news: {
        accept: "After five tries, Rhonda finally gets the date. Sources: \"She earned it\"",
        later: "After five tries, Rhonda finally gets the date. Sources: \"She earned it\"",
        reject: "Rhonda, 44, rejected for a fifth time. Launches a podcast about it" } },
    // 5일 미끼: 이어피스(아내 스파이 단서)인데 무대 통신용 — 보고서 전부 일치 = 진짜
    { id: "c20", nationality: "Korean", day: 5, image: "img/faces/painted-c20.webp", requestSource: "Swipr", timeCost: 70, clue: "earpiece",
      profile: { name: "June", age: "33", job: "Teleprompter operator", hangout: "Your keynote venue, rehearsing", knows: "Your stage crew", intro: "I control what you say on stage. Be nice." },
      chat: ["Be nice or your keynote says SIX SEVEN.", "I control the teleprompter. Absolute cinema."],
      report: { intranet: "Vendor, not staff", checkin: "Keynote venue", friends: "Stagehands (14)", birth: "Born 1993" },
      disguise: null, effects: { stock: 5, suspicion: 2 },
      acceptLine: "SIX SEVEN. Sorry. You can afford the stock dip." },
    { id: "c21", nationality: "American", day: 5, image: "img/faces/painted-c21.webp", requestSource: "Swipr", clue: "weddingRing",
      profile: { name: "Jane Doe", age: "51", job: "Something normal", hangout: "Home, mostly", knows: "Nobody you know. Nobody.", intro: "The wig is my real hair. This is my real voice." },
      chat: ["Hey stranger. Weird way to spell husband.", "Chat, is he cooked? I'm literally downstairs.", { sys: "Distance: 12 ft" }],
      report: { intranet: "", checkin: "Your house", friends: "She IS your wife", birth: "Born 1975" },
      disguise: "wife_spy", effects: {},
      news: {
        accept: "{ceo} matches with his own wife on Swipr. Couples therapist cancels vacation",
        reject: "{ceo} swipes left on his own wife. She has screenshots" } }
  ],

  /* ---------------- 카메오: 실존했던 고인 스파이 (퍼블릭 도메인 사진, 출처는 credits) ----------------
   * candidates와 같은 구조 + cameo(credits의 id). 다른 인물로 바꾸려면 이 배열 항목과 credits만 교체.
   * 위장은 rival_spy → 결정적 어긋남은 3번 행(SNS 체크인 = 경쟁사 본사) 하나뿐, 나머지 행은 프로필과 맞아야 함.
   * rival_spy는 3번 행이 열리는 3일차 이후에만 등장 가능. 나이는 출생연도 그대로(예: 150 / Born 1876) → 2번 행도 일치. */
  cameos: [
    { id: "k-mata-hari", nationality: "Dutch", day: 3, cameo: "mata-hari", image: "img/cameo/painted-mata-hari.jpg", requestSource: "Swipr", clue: "rivalBadge",
      profile: { name: "Mata Hari", age: "150", job: "Dancer (self-taught)", hangout: "Paris cabarets", knows: "Officers, mostly", intro: "I get along great with officers. And CEOs." },
      chat: ["Your roadmap. My Roman Empire.", "Girl Processing Unit. Send specifications.", { sys: "Saved in her contacts as: H-21" }],
      report: { intranet: "", checkin: "Spudtel HQ (x40)", friends: "Officers (12)", birth: "Born 1876" },
      disguise: "rival_spy", effects: {},
      news: { accept: "mVIDIA roadmap found in a cabaret costume trunk. Spudtel: \"No idea how\"" } },
    { id: "k-juan-pujol-garcia", nationality: "Spanish", day: 4, cameo: "juan-pujol-garcia", image: "img/cameo/painted-juan-pujol-garcia.jpg", requestSource: "Swipr",
      profile: { name: "Juan", age: "114", job: "Chicken farmer", hangout: "Lisbon cafés", knows: "Lots of friends (27)", intro: "Used to run a chicken farm. Very social." },
      chat: ["27 friends. Zero real. Dead internet dating.", "Source? My other 26 accounts."],
      report: { intranet: "", checkin: "WaffleSemi HQ", friends: "27 pen pals", birth: "Born 1912" },
      disguise: "rival_spy", effects: {},
      news: { accept: "WaffleSemi receives 27 detailed reports on mVIDIA, all from people who don't exist" } },
    { id: "k-josephine-baker", nationality: "French", day: 5, cameo: "josephine-baker", image: "img/cameo/painted-josephine-baker.jpg", requestSource: "Swipr",
      profile: { name: "Josephine", age: "120", job: "Singer & dancer", hangout: "World tours", knows: "Half of Paris", intro: "Always on tour. Always carrying sheet music." },
      chat: ["500 Days of Chips. You like The Chips?", "Sheet music only. Definitely not chip specs."],
      report: { intranet: "", checkin: "CarpChip HQ", friends: "Half of Paris", birth: "Born 1906" },
      disguise: "rival_spy", effects: {},
      news: { accept: "CarpChip's new single hides mVIDIA clock speeds in invisible ink" } },
    { id: "k-sidney-reilly", nationality: "British", day: 5, cameo: "sidney-reilly", image: "img/cameo/painted-sidney-reilly.jpg", requestSource: "Swipr", clue: "rivalBadge",
      profile: { name: "Sidney", age: "153", job: "Import/export", hangout: "Hotel lobbies", knows: "Several ex-spouses (may overlap)", intro: "Several passports. All of them current-ish." },
      chat: ["One man. Eleven passports. Multiverse rizz.", "Which identity are we soft-launching tonight?"],
      report: { intranet: "", checkin: "Spudtel HQ", friends: "3 ex-spouses", birth: "Born 1873?" },
      disguise: "rival_spy", effects: {},
      news: { accept: "Spudtel's new \"import/export\" guy has eleven passports and your roadmap" } },
    { id: "k-nancy-wake", nationality: "New Zealander", day: 5, cameo: "nancy-wake", image: "img/cameo/painted-nancy-wake.jpg", requestSource: "Swipr", clue: "rivalBadge",
      profile: { name: "Nancy", age: "114", job: "Journalist", hangout: "Champagne bars", knows: "Party people", intro: "Champagne lover. Party queen. Hard to catch." },
      chat: ["White Mouse. Max stealth. Zero chill.", "Coldplay tickets? Babe, turn the kiss cam off."],
      report: { intranet: "", checkin: "WaffleSemi HQ", friends: "The whole party", birth: "Born 1912" },
      disguise: "rival_spy", effects: {},
      news: { accept: "Party guest called \"the White Mouse\" leaves with mVIDIA's Wi-Fi password. The real one" } }
  ],

  /* 카메오 사진 출처 (엔딩·타이틀의 Credits에 표시). file = 게임 안 경로, source = Commons 파일 페이지 */
  credits: [
    { id: "mata-hari", name: "Mata Hari", file: "img/cameo/mata-hari.jpg", source: "https://commons.wikimedia.org/wiki/File:MataHari15.jpg", license: "PD-Art | PD-old-100" },
    { id: "josephine-baker", name: "Josephine Baker", file: "img/cameo/josephine-baker.jpg", source: "https://commons.wikimedia.org/wiki/File:Baker_Harcourt_1940_2.jpg", license: "PD-France" },
    { id: "juan-pujol-garcia", name: "Juan Pujol García", file: "img/cameo/juan-pujol-garcia.jpg", source: "https://commons.wikimedia.org/wiki/File:Joan_pujol_garcia.jpg", license: "PD-UKGov" },
    { id: "sidney-reilly", name: "Sidney Reilly", file: "img/cameo/sidney-reilly.jpg", source: "https://commons.wikimedia.org/wiki/File:Sidney_Reilly_German_Passport_September_1918.jpg", license: "PD-GermanGov" },
    { id: "nancy-wake", name: "Nancy Wake", file: "img/cameo/nancy-wake.jpg", source: "https://commons.wikimedia.org/wiki/File:Nancy_Wake_%281945%29.jpg", license: "PD-Australia" }
  ],

  /* ---------------- 하루 끝 뉴스: 캡처 한 장 카드 (BREAKING 1줄 + 서브 1~2줄 + 주가 크롤) ---------------- */
  news: {
    maxPerDay: 3,
    minPerDay: 2,
    priority: {
      trumpCall: 100,
      fired: 110,
      "later:insider": 7, "accept:wife_spy": 6, "accept:rival_spy": 6,
      "accept:android": 5, "warn:suspicion": 105, "warn:security": 4,
      "expired": 4, "accept:insider": 4, "citation": 3,
      "reject:wife_spy": 3, "reject:rival_spy": 3, "reject:android": 3, "reject:insider": 3,
      "stockUp": 2, "stockDown": 2, "accept:legit": 2,
      "later:legit": 8, "reject:legit": 1, "filler": 0, "default": 1
    },
    templates: {
      trumpCall: ["TRUMP CALLING: Your date has triggered a tariff on your love life."],
      fired: ["Johnson Huang fired after second phone leak. Shares crash. He keeps the jacket."],
      "accept:legit": [
        "{ceo} seen humming in the elevator. Analysts: \"Bullish\"",
        "CEO's \"offsite meeting\" runs long again. Assistant: \"It is a meeting\"",
        "Retail investors read the CEO's glow as a buy signal. MVDA ticks up",
        "Leather jacket spotted at a candlelit table for two. Market: \"Priced in\"",
        "{ceo} cancels 4pm \"for a board thing.\" There is no board thing"
      ],
      "reject:legit": [
        "Perfectly nice woman swiped left by a billionaire. \"His loss,\" she says. Correct",
        "Fixer files report on a match the CEO declined: \"She was fine. Great, actually\""
      ],
      "accept:wife_spy": [
        "Cold soup and colder silence at the Jang house tonight",
        "Wife \"just curious\" why the CEO's phone unfolds into a second phone",
        "Divorce lawyers line up outside mVIDIA HQ like it's a product launch"
      ],
      "reject:wife_spy": [
        "Mystery woman leaves café disappointed, calls \"the client\"",
        "Wife's group chat goes suspiciously quiet. Then: \"He said no.\""
      ],
      "accept:android": [
        "{ceo} seen on a date. Partner's ear briefly glows mVIDIA green",
        "mVIDIA statement on CEO's date: \"We are simply dogfooding our product\"",
        "CEO's date asks the waiter for \"a charger, any charger\""
      ],
      "reject:android": [
        "mVIDIA warehouse logs one return. Reason: \"Emotional damage\"",
        "Unit declined by the CEO files a bug report. Severity: heart"
      ],
      "accept:rival_spy": [
        "HONEYPOTTED: mVIDIA roadmap now trending on a rival's intranet",
        "If she's a 10, she's an asset. Sources confirm: she was a 10",
        "Rival unveils a chip \"eerily similar\" to mVIDIA's. \"Coincidence,\" they wink"
      ],
      "reject:rival_spy": [
        "Security escorts out a \"tourist\" carrying 37 USB sticks",
        "Rival HR quietly lists one honeypot as \"returned unopened\""
      ],
      "accept:insider": [
        "mVIDIA staffer posts \"dinner w/ the boss ;)\" in the all-hands channel"
      ],
      "later:insider": [
        "Regulators open probe into an mVIDIA staffer's very well-timed trades",
        "mVIDIA employee bought calls the night before a \"date.\" Regulators: \"Interesting\""
      ],
      "reject:insider": [
        "HR thanks the CEO for \"not doing the thing, for once\"",
        "mVIDIA staffer updates status: \"It's complicated (with the boss)\""
      ],
      "expired": [
        "{n} unread on a mysterious second phone. Someone at home heard it buzz",
        "Folded phone buzzes in a jacket at dinner. {n} times. Wife counted"
      ],
      "citation": [
        "Compliance slides {n} violation notice(s) onto the CEO's desk. Again"
      ],
      "warn:suspicion": [
        "Wife asks why the \"boiler\" vibrates in rhythm",
        "Wife now \"just tidying\" the CEO's jacket pockets. Twice a day"
      ],
      "warn:security": [
        "mVIDIA security team takes a collective sick day",
        "IT begs the CEO to \"please stop pairing Bluetooth with strangers\""
      ],
      "stockUp": [
        "MVDA closes at {price}. Retail army: \"In Johnson we trust\"",
        "MVDA closes at {price}. Analysts credit \"vibes\""
      ],
      "stockDown": [
        "MVDA closes at {price}. Leather jacket sales fall in sympathy",
        "MVDA slides to {price}. CEO seen buying a second leather jacket"
      ],
      "filler": [
        "Slow news day at mVIDIA. Reporters disappointed",
        "Global leather jacket shortage enters week two",
        "Analysts downgrade foldable phones to \"suspicious\""
      ]
    }
  },

  /* ---------------- 엔딩 (위에서부터 첫 일치) ---------------- */
  endings: [
    { id: "divorce_rich", rank: 1, mood: "shocked", title: "Stock's Up, Wife's Gone",
      line: "New all-time high. New locks at home. She kept the foldable.",
      when: { gameOver: "suspicion", peakStock: [55, Infinity] } },
    { id: "caught", rank: 0, mood: "shocked", title: "It Buzzed During Dinner",
      line: "The phone unfolded itself at the dinner table. The keynote went on without him.",
      when: { gameOver: "suspicion" } },
    { id: "security_cry", rank: 0, mood: "shocked", title: "Security Team Is Crying",
      line: "Next-gen chip blueprints are now somebody's dating profile pic.",
      when: { security: [0, 40] } },
    { id: "android_marriage", rank: 4, mood: "happy", title: "Married to Our Own Product",
      line: "Best performance-per-watt spouse ever. Goes quiet during firmware updates.",
      when: { androidAccepted: [1, 99] } },
    { id: "legend", rank: 5, mood: "smug", title: "Legend of the Leather Jacket",
      line: "Stock to the moon, suspicion on the floor, chip in hand. Flawless.",
      when: { stock: [90, 100], suspicion: [0, 99], security: [70, 100] } }, // 90: 진짜를 거의 다 받아야(미끼 포함) — 스티커 거르기로는 못 닿음
    { id: "insider_speedrun", rank: 1, mood: "shocked", title: "Insider Trading Speedrun",
      line: "Regulators now know his coffee order. And his other phone.",
      when: { insiderAccepted: [2, 99] } },
    { id: "dnd", rank: 1, mood: "neutral", title: "Do Not Disturb Mode",
      line: "Thirty matches, zero dates. The second phone died quietly in a drawer.",
      when: { accepted: [0, 3] } },
    { id: "delisted", rank: 0, mood: "shocked", title: "Delisted, Still Drippin'",
      line: "The jacket stays. The stock doesn't.",
      when: { stock: [0, 25] } },
    { id: "edge", rank: 2, mood: "smug", title: "Living on the Edge (of the Couch)",
      line: "Survived because his wife believed the buzzing was the boiler.",
      when: { suspicion: [70, 100] } },
    { id: "mid", rank: 3, mood: "neutral", title: "Mid CEO Energy",
      line: "Some stock, some suspicion, polite applause.",
      when: {} }
  ],

  keynote: {
    lines: ["Ladies and gentlemen.", "Today, mVIDIA is proud to unveil..."],
    chipLine: "...this.",
    lineMs: 1500,
    silenceMs: 3000
  },

  art: {
    declineVideo: "img/memes/decline.mp4",
    background: "img/bg/office.png",
    keynoteBackground: "img/bg/keynote.png",
    ceo: {
      neutral: "img/ceo/painted-neutral.webp",
      happy: "img/ceo/painted-happy.webp",
      shocked: "img/ceo/painted-shocked.webp",
      smug: "img/ceo/painted-smug.webp"
    }
  },

  donate: {
    url: "", // ★TODO(itch.io): 후원 링크를 여기에 (예: https://<user>.itch.io/<game>/purchase)
    title: "Tip Johnson",
    tiers: ["A coffee", "One stick of RAM", "A graphics card (sold out)"],
    pending: "Tip link coming soon"
  },

  ui: {
    nationalityLabel: "Nationality",
    nationalityUnknown: "Not verified",
    declineVideoLabel: "BONUS CLIP · I'll decline. No regrets.",
    trumpCaller: "INCOMING CALL · THE WHITE HOUSE",
    trumpName: "Donald · 47 missed calls",
    trumpLine: "Johnson. Your love life has a trade deficit. Tremendous tariffs. Effective immediately.",
    trumpImpact: "CALL ENDED · TARIFF SHOCK ALREADY INCLUDED IN TODAY'S CLOSE",
    title: "How High Can You Pump mVIDIA?",
    subtitle: "Good dates. Better productivity. Bigger stock.",
    disclaimer: "A parody. Not affiliated with any real person or company.",
    howto: [
      "Matches land on Johnson Huang's secret second phone.",
      "A fixer checks each one. Compare Profile vs Report, row by row.",
      "Good dates boost productivity and stock. Chinese dates pay 1.5x; spies crash it.",
      "Suspicion never falls. At 100 you are fired. Survive five days; brag about your stock wealth."
    ],
    start: "Unfold the phone",
    resume: "Continue — Day {day}",
    restart: "Start over",
    restartConfirm: "Tap again to wipe the save",
    beginDay: "Open Swipr",
    accept: "Accept",
    reject: "Decline",
    nextDay: "Next day",
    toKeynote: "Walk on stage",
    toEnding: "Face the music",
    replay: "Unfold again",
    menu: "Menu",
    close: "Close",
    profile: "Profile",
    report: "Fixer report",
    dayShort: "Day {day}",
    left: "{n} left",
    newRule: "New rule today",
    earlierRules: "Earlier rules {n}",
    noNewRule: "No new rules. Good luck.",
    advisory: "(advisory only: not a violation)",
    eveningNews: "The Silicon Tattler · Day {day}",
    todayStats: "Dates {accepted} · Declined {rejected} · Unread {expired}",
    missed: "Violations {n}",
    citationTitle: "Compliance notice",
    citationLine: "{name}: row {rules}",
    endingKicker: "Day {day}. Keynote. Chip in hand. Three seconds of silence.",
    endingKickerCaught: "Day {day}. The second phone buzzed at dinner.",
    endingStats: "Dates {accepted} · Declined {rejected} · Unread {expired} · Violations {citations}",
    chartStart: "Open",
    chartDay: "Day {day}",
    skin: "{source} · Day {day}",
    skinLive: "LIVE",          // badge on the news TV + desktop facecam
    skinBreaking: "BREAKING",  // tag on the lead headline
    // desktop stock window (beside the phone, viewport ≥ 900px)
    stockToday: "{pct} on the day",
    stockOpen: "{time} · Opening bell",
    stockAccepted: "{time} · Date: {name}",
    stockDeclined: "{time} · Passed: {name}",
    stockClose: "{time} · Closing bell. Phone folded.",
    credits: "Credits",
    creditsIntro: "Cameo photos via Wikimedia Commons:",
    creditsLine: "Cameo photos: Wikimedia Commons (public domain). Faces are placeholders.",
    seed: "seed {seed}"
  }
};
