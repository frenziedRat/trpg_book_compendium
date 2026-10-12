/**
 * Draw Steel Web Rulebook - Category Gate Grid Generator
 */
(function () {
    const scriptEl =
        document.currentScript ||
        Array.from(document.scripts).find(s => /\/gate-grid\.js(\?|#|$)/.test(s.src));

    const siteRoot = (() => {
        if (!scriptEl) return new URL("./", window.location.href);
        const src = scriptEl.src;
        const i = src.lastIndexOf("/assets/");
        return i !== -1 ? new URL(src.slice(0, i + 1)) : new URL("../", src);
    })();

    const toUrl = (p) => new URL((p || "").replace(/^\/+/, "").replace(/\\/g, "/"), siteRoot);

    // 제목에서 한글과 영문 분리 ("악마 Devil" -> ko: "악마", en: "Devil")
    function parseTitle(titleStr) {
        if (!titleStr) return { ko: "", en: "" };
        const match = titleStr.match(/^([^\x00-\x7F\s]+(?:\s+[^\x00-\x7F\s]+)*)\s+([A-Za-z0-9\s'-]+)$/);
        if (match) {
            return { ko: match[1].trim(), en: match[2].trim() };
        }
        return { ko: titleStr.trim(), en: "" };
    }

    // 카테고리 매칭 로직 (어떤 로컬 서버 환경에서도 100% 매칭)
    function findCategoryItems(manifest, categoryKey) {
        // 현재 브라우저의 pathname만 안전하게 추출 (소문자 및 디코딩)
        let herePath = "";
        try {
            herePath = decodeURIComponent(window.location.pathname).toLowerCase();
        } catch (e) {
            herePath = window.location.pathname.toLowerCase();
        }

        let foundChildren = null;

        function search(items) {
            for (const item of items) {
                const itemPath = (item.path || "").replace(/^\/+/, "").toLowerCase();
                const itemTitle = (item.title || "").toLowerCase();

                // 1. data-category 명시 시 매칭
                if (categoryKey && (itemTitle.includes(categoryKey.toLowerCase()) || itemPath.includes(categoryKey.toLowerCase()))) {
                    foundChildren = item.children || [];
                    return;
                }

                // 2. 경로 끝자리 매칭 (예: /draw_steel_starter_docs/draw-steel/data/ancestry.html 이 draw-steel/data/ancestry.html 로 끝나는지 확인)
                if (itemPath && herePath.endsWith(itemPath)) {
                    foundChildren = item.children || [];
                    return;
                }

                // 3. 파일명 매칭 (fallback: ancestry.html)
                const currentFileName = herePath.split("/").pop();
                const itemFileName = itemPath.split("/").pop();
                if (currentFileName && itemFileName && currentFileName === itemFileName) {
                    foundChildren = item.children || [];
                    return;
                }

                // 하위 그룹 탐색
                if (item.children && Array.isArray(item.children)) {
                    search(item.children);
                    if (foundChildren) return;
                }
            }
        }

        search(manifest);
        return foundChildren || [];
    }

    function initGateGrids() {
        const manifest = window.SITE_MANIFEST || [];
        const containers = document.querySelectorAll(".gate-grid, .choice-grid[data-category]");

        containers.forEach(container => {
            const categoryKey = container.dataset.category || "";
            const items = findCategoryItems(manifest, categoryKey);

            if (!items || items.length === 0) {
                console.warn("[GateGrid] 하위 항목을 찾을 수 없습니다:", window.location.pathname);
                return;
            }

            container.innerHTML = "";
            container.classList.add("choice-grid");

            items.forEach(item => {
                const isDraft = !!item.draft;
                const isAnchor = item.path && item.path.startsWith("#");
                const href = isDraft ? "#" : (isAnchor ? item.path : toUrl(item.path).href);

                const parsed = parseTitle(item.title);
                const koText = item.ko || parsed.ko;
                const enText = item.en || parsed.en;

                const btn = document.createElement("a");
                btn.className = "choice-btn";
                btn.href = href;

                if (isDraft) {
                    btn.classList.add("is-draft");
                    btn.setAttribute("aria-disabled", "true");
                    btn.onclick = (e) => e.preventDefault();
                }

                let innerHtml = `<span class="ko">${koText}</span>`;
                if (enText) {
                    innerHtml += `<span class="en">${enText}</span>`;
                }

                if (isDraft) {
                    innerHtml += `<span class="gate-draft-badge">작성중</span>`;
                }

                btn.innerHTML = innerHtml;
                container.appendChild(btn);
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initGateGrids);
    } else {
        initGateGrids();
    }
})();