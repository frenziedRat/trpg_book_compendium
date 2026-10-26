// assets/manifest.js

// 프로젝트 루트 기준의 경로 목록 또는 상대/절대 경로 리스트
// assets/manifest.js
//
// 항목 형식
//   { title: "제목", path: "폴더/파일.html" }                 일반 문서 (1페이지짜리는 눌러서 바로 이동)
//   { title: "묶음", children: [ { title, path }, ... ] }      하위 메뉴가 있는 묶음 (목차에서 눌러서 펼침)
//
//   - 하위 메뉴(children)는 pager 의 좌측 목차에서 현재 보고 있는 문서가 그 안에 있을 때 자동으로 펼쳐집니다.
//     항상 펼쳐 두려면 묶음에 open: true 를 추가하세요.
//   - 이전/다음 버튼은 위에서 아래로 펼친 이 순서(path 가 있는 문서만)를 따릅니다.
//   - draw_steel_index.html 에서는 왼쪽 "시작 규칙" / 오른쪽 "데이터" 두 단으로 나뉩니다.
//     경로(또는 묶음 안 첫 문서의 경로)에 "/starter-rule/" 이 있으면 왼쪽, 아니면 오른쪽이고,
//     직접 정하려면 항목에 column: "left" 또는 column: "right" 를 추가하세요.

window.SITE_HOME = { title: "홈", path: "draw-steel/" };   // 이름·대상 변경

window.SITE_MANIFEST = [
    // ---- 시작 규칙 (왼쪽) ----
    {   title: "기초", path: "draw-steel/rule/starter-rule/basic.html" },
    {   title: "능력", path: "draw-steel/rule/starter-rule/abilities.html" },
    {   title: "상태이상", path: "draw-steel/rule/starter-rule/condition.html" },
    {   title: "시도 test", path: "draw-steel/rule/starter-rule/test.html" },
    {   title: "전투", path: "draw-steel/rule/starter-rule/combat.html"},
    {   title: "협상", path: "draw-steel/rule/starter-rule/negotiation.html", draft: true },
    {   title: "명성", path: "draw-steel/rule/starter-rule/renown.html", draft: true },
    {   title: "재산", path: "draw-steel/rule/starter-rule/wealth.html", draft: true },

    // ---- 데이터 (오른쪽) ----
    {   title: "종족", path: "draw-steel/data/ancestry.html",
        children: [
            { title: "고위 엘프 High Elf", path: "draw-steel/data/ancestry/high-elf.html" },
            { title: "드워프 Dwarf", path: "draw-steel/data/ancestry/dwarf.html" },
            { title: "망자 Revenant", path: "draw-steel/data/ancestry/revenant.html" },
            { title: "메모넥 Memonek", path: "draw-steel/data/ancestry/memonek.html" },
            { title: "시공 약탈자 Time Raider", path: "draw-steel/data/ancestry/time-raider.html" },
            { title: "악마 Devil", path: "draw-steel/data/ancestry/devil.html" },
            { title: "야생 엘프 Wode Elf", path: "draw-steel/data/ancestry/wode-elf.html" },
            { title: "오크 Orc", path: "draw-steel/data/ancestry/orc.html" },
            { title: "용기사 Dragon Knight", path: "draw-steel/data/ancestry/dragon-knight.html" },
            { title: "인간 Human", path: "draw-steel/data/ancestry/human.html" },
            { title: "폴더 Polder", path: "draw-steel/data/ancestry/polder.html" },
            { title: "하칸 Hakkan", path: "draw-steel/data/ancestry/hakkan.html"},
        ]
    },
    {
        title: "직군",
        children: [
            { title: "사도 Conduit", path: "draw-steel/data/class/conduit.html", draft: true},
            { title: "암행자 Shadow", path: "draw-steel/data/class/shadow.html"},
            // { title: "다음 직군", path: "draw-steel/data/class-xxx.html" },
        ]
    },
    // {
    //     title: "키트",
    //     children: [
    //         { title: "키트 이름", path: "draw-steel/kit/kit-xxx.html" },
    //     ]
    // },
];