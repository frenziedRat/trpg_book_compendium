document.addEventListener("DOMContentLoaded", () => {
    // 1. 대상 선택자에 .tip 추가
    const targetSelector = ".tag, .kw, .action-cost, .tip";
    const targets = document.querySelectorAll(targetSelector);

    // 2. 초기 로드 시 각 태그의 기준 한글(koText)과 영문(enText) 분석 및 저장
    targets.forEach(el => {
        const style = getComputedStyle(el);
        const cssKo = (style.getPropertyValue("--tag-ko") || "").replace(/["']/g, "").trim();
        const cssEn = (style.getPropertyValue("--tag-en") || "").replace(/["']/g, "").trim();
        const originalText = el.textContent.trim();

        // 영문명이 CSS에 정의되어 있지 않은 일반 태그는 건너뜀
        if (!cssEn) return;

        // 기준 한글 결정:
        // HTML에 글자가 직접 적혀 있으면 그 글자를 우선 사용,
        // 비어 있다면 CSS의 --tag-ko 사용 (.damage 태그는 뒤에 " 피해" 부착)
        let baseKo = originalText;
        if (!baseKo) {
            const isDamage = el.classList.contains("damage");
            baseKo = isDamage ? `${cssKo} 피해` : cssKo;
        }

        if (baseKo) {
            el.dataset.langTarget = "true";
            el.dataset.baseKo = baseKo;
            el.dataset.baseEn = cssEn;
        }
    });

    // 3. 언어 모드 변경에 따른 실제 DOM 텍스트(textContent) 갱신
    function applyTextContent(mode) {
        document.querySelectorAll("[data-lang-target='true']").forEach(el => {
            const ko = el.dataset.baseKo;
            const en = el.dataset.baseEn;

            if (mode === "dual") {
                el.textContent = `${ko} ${en}`; // [한/영] 모드: 한글 + 영문 병기
            } else {
                el.textContent = ko;            // [한] 모드: 한글만 표시
            }
        });
    }

    // 4. 우측 상단 토글 버튼 생성 및 상태 동기화
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "lang-toggle-btn";
    btn.setAttribute("aria-label", "언어 표기 전환");

    const savedMode = localStorage.getItem("drawsteel-lang-mode") || "ko";

    function updateLanguage(mode) {
        if (mode === "dual") {
            btn.textContent = "[ 혼용 ]";
            btn.title = "현재: 한/영 병기 모드 (클릭 시 한국어 전용)";
        } else {
            btn.textContent = "[ 한글 ]";
            btn.title = "현재: 한국어 모드 (클릭 시 한/영 병기)";
        }
        applyTextContent(mode);
        localStorage.setItem("drawsteel-lang-mode", mode);
    }

    // 초기 모드 적용
    updateLanguage(savedMode);

    // 버튼 클릭 루프
    btn.addEventListener("click", () => {
        const currentMode = localStorage.getItem("drawsteel-lang-mode") || "ko";
        updateLanguage(currentMode === "ko" ? "dual" : "ko");
    });

    document.body.appendChild(btn);
});