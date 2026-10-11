document.addEventListener("DOMContentLoaded", () => {
    // 1. 대상 선택자에 .trait.badge 및 [term-en] 속성 요소 추가
    const targetSelector = ".tag, .kw, .action-cost, .tip, .trait.badge, [term-en]";
    const targets = document.querySelectorAll(targetSelector);

    // 2. 각 태그의 기준 한글(ko)과 영문(en) 분석 및 저장
    targets.forEach(el => {
        const style = getComputedStyle(el);
        const termEn = el.getAttribute("term-en");
        const cssEn = (style.getPropertyValue("--tag-en") || "").replace(/["']/g, "").trim();
        const cssKo = (style.getPropertyValue("--tag-ko") || "").replace(/["']/g, "").trim();
        const originalText = el.textContent.trim();

        // HTML의 term-en 속성을 최우선 사용, 없으면 CSS의 --tag-en 사용
        const baseEn = termEn || cssEn;
        if (!baseEn) return;

        // 기준 한글 결정: HTML에 적힌 텍스트 우선, 비어있으면 CSS --tag-ko 사용
        let baseKo = originalText;
        if (!baseKo) {
            const isDamage = el.classList.contains("damage");
            baseKo = isDamage ? `${cssKo} 피해` : cssKo;
        }

        if (baseKo) {
            el.dataset.langTarget = "true";
            el.dataset.baseKo = baseKo;
            el.dataset.baseEn = baseEn;
        }
    });

    // 3. 텍스트 치환 함수
    function applyTextContent(mode) {
        document.querySelectorAll("[data-lang-target='true']").forEach(el => {
            const ko = el.dataset.baseKo;
            const en = el.dataset.baseEn;

            if (mode === "dual") {
                el.textContent = `${ko} ${en}`; // [혼용] 한글 뒤에 영문 결합
            } else {
                el.textContent = ko;            // [한글] 한글만 표시
            }
        });
    }

    // 4. 버튼 생성 및 상태 동기화
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "lang-toggle-btn";
    btn.setAttribute("aria-label", "언어 표기 전환");

    const savedMode = localStorage.getItem("drawsteel-lang-mode") || "ko";

    function updateLanguage(mode) {
        if (mode === "dual") {
            btn.textContent = "[ 혼용 ]";
            btn.title = "현재: 한/영 병기 모드 (클릭 시 한국어 전용)";
            document.body.classList.add("show-tips"); // CSS에서 툴팁 제어용 클래스
        } else {
            btn.textContent = "[ 한글 ]";
            btn.title = "현재: 한국어 모드 (클릭 시 한/영 병기)";
            document.body.classList.remove("show-tips");
        }
        applyTextContent(mode);
        localStorage.setItem("drawsteel-lang-mode", mode);
    }

    // 초기 모드 실행
    updateLanguage(savedMode);

    btn.addEventListener("click", () => {
        const currentMode = localStorage.getItem("drawsteel-lang-mode") || "ko";
        updateLanguage(currentMode === "ko" ? "dual" : "ko");
    });

    document.body.appendChild(btn);
});