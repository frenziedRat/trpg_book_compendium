document.addEventListener("DOMContentLoaded", () => {
    // 1. 토글 버튼 생성
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "lang-toggle-btn";
    btn.setAttribute("aria-label", "언어 표기 전환");

    // 2. 저장된 언어 모드 불러오기 (기본값: 'ko')
    const savedMode = localStorage.getItem("drawsteel-lang-mode") || "ko";

    function updateLanguage(mode) {
        if (mode === "dual") {
            document.body.classList.add("show-tips");
            btn.textContent = "[ 혼용 ]";
            btn.title = "현재: 한/영 병기 모드 (클릭 시 한국어 전용)";
        } else {
            document.body.classList.remove("show-tips");
            btn.textContent = "[ 한글만 ]";
            btn.title = "현재: 한국어 모드 (클릭 시 한/영 병기)";
        }
        localStorage.setItem("drawsteel-lang-mode", mode);
    }

    // 초기 상태 적용
    updateLanguage(savedMode);

    // 3. 클릭 시 [한] <-> [한/영] 루프
    btn.addEventListener("click", () => {
        const isDual = document.body.classList.contains("show-tips");
        updateLanguage(isDual ? "ko" : "dual");
    });

    document.body.appendChild(btn);
});