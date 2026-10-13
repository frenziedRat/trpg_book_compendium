(function () {
    const colsEl = document.getElementById("toc-cols");

    // ----------------------------------------------------
    // 1. tooltip.js와 동일한 규칙으로 현재 룰 시스템 자동 감지
    // ----------------------------------------------------
    function detectRuleSystem() {
        if (document.documentElement.dataset.rule) {
            return document.documentElement.dataset.rule;
        }
        const ruleLink = document.querySelector('link[href*="/assets/system/"]');
        if (ruleLink) {
            const match = ruleLink.getAttribute("href").match(/\/assets\/system\/([^\/]+)\//);
            if (match) return match[1];
        }
        return "draw_steel";
    }

    const ruleName = detectRuleSystem();

    // ----------------------------------------------------
    // 2. 사이트 루트 경로 산출
    // ----------------------------------------------------
    const siteRoot = (() => {
        // manifest.js 또는 assets 하위 리소스 링크를 기준으로 루트 추출
        const refEl = document.querySelector('script[src*="manifest.js"], link[href*="/assets/"], script[src*="/assets/"]');
        if (refEl) {
            const src = refEl.src || refEl.href || "";
            const i = src.lastIndexOf("/assets/");
            if (i !== -1) return new URL(src.slice(0, i + 1));
        }
        return new URL("./", window.location.href);
    })();

    const toUrl = (p) => new URL((p || "").replace(/^\/+/, "").replace(/\\/g, "/"), siteRoot);

    const backBtn = document.getElementById("toc-back");
    if (backBtn) {
        backBtn.href = new URL("index.html", siteRoot).href;
    }

    // ----------------------------------------------------
    // 상태 메시지 표시
    // ----------------------------------------------------
    function code(text) {
        const c = document.createElement("code");
        c.textContent = text;
        return c;
    }

    function showMessage(title, bodyNodes) {
        const box = document.createElement("div");
        box.className = "toc-message";
        const strong = document.createElement("strong");
        strong.textContent = title;
        box.appendChild(strong);
        bodyNodes.forEach((n) => box.appendChild(typeof n === "string" ? document.createTextNode(n) : n));
        if (colsEl) colsEl.replaceWith(box);
    }

    // ----------------------------------------------------
    // 3. manifest.js 동적 로드 및 실행
    // ----------------------------------------------------
    async function init() {
        // HTML에 미리 script로 로드되지 않은 경우 동적으로 로드
        if (!Array.isArray(window.SITE_MANIFEST)) {
            const manifestUrl = new URL(`assets/system/${ruleName}/manifest.js`, siteRoot).href;
            try {
                await new Promise((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = manifestUrl;
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error(`Failed to load ${manifestUrl}`));
                    document.head.appendChild(script);
                });
            } catch (err) {
                console.warn("[ContentsTable] manifest.js 동적 로드 실패:", err);
            }
        }

        const manifest = window.SITE_MANIFEST;
        if (!Array.isArray(manifest)) {
            // 하드코딩 제거: 현재 감지된 ruleName을 기반으로 동적 경로 표시
            showMessage("manifest.js 를 불러오지 못했습니다.", [
                "이 파일에 ",
                code(`<script src="../assets/system/${ruleName}/manifest.js">`),
                " 가 포함되어 있는지 또는 경로가 올바른지 확인하세요."
            ]);
            return;
        }

        buildTableOfContents(manifest);
    }

    // ----------------------------------------------------
    // 목차 렌더링 로직
    // ----------------------------------------------------
    const childrenOf = (item) => (item && Array.isArray(item.children) ? item.children : []);
    const firstPath = (item) => {
        if (item.path) return item.path;
        for (const kid of childrenOf(item)) {
            const p = firstPath(kid);
            if (p) return p;
        }
        return "";
    };
    const columnOf = (item) => {
        if (item.column === "left" || item.column === "right") return item.column;
        return /(^|\/)starter-rule\//.test(firstPath(item).replace(/\\/g, "/")) ? "left" : "right";
    };

    function setOpen(group, open) {
        group.classList.toggle("is-open", open);
        const btn = group.querySelector(":scope > .toc-group-btn");
        if (btn) btn.setAttribute("aria-expanded", String(open));
        if (!open) {
            group.querySelectorAll(".toc-group.is-open").forEach((g) => setOpen(g, false));
        }
    }

    function toggleGroup(group) {
        const willOpen = !group.classList.contains("is-open");
        if (willOpen) {
            document.querySelectorAll(".toc-group.is-open").forEach((other) => {
                if (other !== group && !other.contains(group)) setOpen(other, false);
            });
        }
        setOpen(group, willOpen);
    }

    let groupSeq = 0;
    function renderItems(items, ul) {
        items.forEach((item) => {
            const kids = childrenOf(item);
            const li = document.createElement("li");

            if (kids.length) {
                li.className = "toc-group";
                const panelId = "toc-panel-" + (++groupSeq);

                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "toc-group-btn";
                btn.setAttribute("aria-expanded", "false");
                btn.setAttribute("aria-controls", panelId);

                const label = document.createElement("span");
                label.className = "toc-title";
                label.textContent = item.title || "";
                btn.appendChild(label);

                // 묶음 자체가 draft인 경우
                if (item.draft === true) {
                    btn.classList.add("is-draft");
                    const badge = document.createElement("span");
                    badge.className = "toc-draft-badge";
                    badge.textContent = "작성중";
                    btn.appendChild(badge);
                }

                const caret = document.createElement("span");
                caret.className = "toc-caret";
                caret.setAttribute("aria-hidden", "true");
                btn.appendChild(caret);

                btn.addEventListener("click", () => toggleGroup(li));

                const panel = document.createElement("div");
                panel.className = "toc-panel";
                panel.id = panelId;
                const sub = document.createElement("ul");
                sub.className = "toc-list";

                const children = item.path ? [{ title: "개요", path: item.path, draft: item.draft }, ...kids] : kids;
                renderItems(children, sub);
                panel.appendChild(sub);

                li.append(btn, panel);
                if (item.open === true) setOpen(li, true);
            } else if (item.path) {
                const a = document.createElement("a");
                a.className = "toc-link";

                const label = document.createElement("span");
                label.className = "toc-title";
                label.textContent = item.title || item.path;
                a.appendChild(label);

                // draft 처리
                if (item.draft === true) {
                    a.classList.add("is-draft");
                    a.setAttribute("aria-disabled", "true");
                    a.addEventListener("click", (e) => e.preventDefault());

                    const badge = document.createElement("span");
                    badge.className = "toc-draft-badge";
                    badge.textContent = "작성중";
                    a.appendChild(badge);
                } else {
                    a.href = toUrl(item.path).href;
                }

                li.appendChild(a);
            } else {
                return;
            }
            ul.appendChild(li);
        });
    }

    function buildTableOfContents(manifest) {
        const cols = { left: [], right: [] };
        manifest.forEach((item) => {
            if (!item.path && childrenOf(item).length === 0) return;
            cols[columnOf(item)].push(item);
        });

        if (cols.left.length + cols.right.length === 0) {
            showMessage("등록된 문서가 없습니다.", [
                "manifest.js 의 ",
                code("window.SITE_MANIFEST"),
                " 에 ",
                code('{ title: "제목", path: "폴더/파일.html" }'),
                " 를 추가하세요."
            ]);
            return;
        }

        ["left", "right"].forEach((side) => {
            const section = document.getElementById("toc-" + side);
            const listEl = document.getElementById("toc-" + side + "-list");
            if (!section || !listEl) return;
            if (cols[side].length === 0) {
                section.remove();
                return;
            }
            renderItems(cols[side], listEl);
        });

        if (colsEl && (cols.left.length === 0 || cols.right.length === 0)) {
            colsEl.classList.add("is-single");
        }
    }

    init();
})();