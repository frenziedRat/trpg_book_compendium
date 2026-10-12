(function () {
    const colsEl = document.getElementById("toc-cols");

    // ----------------------------------------------------
    // pager.js 와 같은 경로 규칙
    // ----------------------------------------------------
    // 사이트 루트 = manifest 스크립트 주소에서 "/assets/" 앞부분까지 (manifest.path 의 기준)
    const manifestScript = document.querySelector('script[src*="manifest.js"]');
    const siteRoot = (() => {
        if (!manifestScript) return new URL("./", window.location.href);
        const src = manifestScript.src;
        const i = src.lastIndexOf("/assets/");
        return i !== -1 ? new URL(src.slice(0, i + 1)) : new URL("./", window.location.href);
    })();
    const toUrl = (p) => new URL((p || "").replace(/^\/+/, "").replace(/\\/g, "/"), siteRoot);

    // 이 파일이 루트가 아닌 폴더에 있어도 "RPG 시스템"(루트 index.html)으로 돌아가도록
    document.getElementById("toc-back").href = new URL("index.html", siteRoot).href;

    // ----------------------------------------------------
    // 상태 메시지
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
        colsEl.replaceWith(box);
    }

    const manifest = window.SITE_MANIFEST;
    if (!Array.isArray(manifest)) {
        showMessage("manifest.js 를 불러오지 못했습니다.",
            ["이 파일 하단의 ", code('<script src="../assets/system/draw_steel/manifest.js">'), " 경로를 확인하세요."]);
        return;
    }

    // ----------------------------------------------------
    // 어느 쪽 단에 넣을지: 항목의 column ("left" | "right") 이 있으면 그것을, 없으면 경로로 판단
    //  - 경로(또는 하위 문서 중 첫 경로)에 "/starter-rule/" 이 있으면 왼쪽(시작 규칙), 아니면 오른쪽(데이터)
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

    // ----------------------------------------------------
    // 묶음(아코디언): 하나를 펼치면 나머지(조상 제외)는 접힘
    // ----------------------------------------------------
    function setOpen(group, open) {
        group.classList.toggle("is-open", open);
        group.querySelector(":scope > .toc-group-btn").setAttribute("aria-expanded", String(open));
        if (!open) {   // 접을 때는 안쪽에 펼쳐 둔 묶음도 함께 접음
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
                // 묶음: 누르면 펼쳐짐
                li.className = "toc-group";
                const panelId = "toc-panel-" + (++groupSeq);

                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "toc-group-btn";
                btn.setAttribute("aria-expanded", "false");
                btn.setAttribute("aria-controls", panelId);
                const label = document.createElement("span");
                label.textContent = item.title || "";
                const caret = document.createElement("span");
                caret.className = "toc-caret";
                caret.setAttribute("aria-hidden", "true");
                btn.append(label, caret);
                btn.addEventListener("click", () => toggleGroup(li));

                const panel = document.createElement("div");
                panel.className = "toc-panel";
                panel.id = panelId;
                const sub = document.createElement("ul");
                sub.className = "toc-list";

                // 묶음 자체에도 문서(path)가 있으면 맨 앞에 "개요"로 연결
                const children = item.path ? [{ title: "개요", path: item.path }, ...kids] : kids;
                renderItems(children, sub);
                panel.appendChild(sub);

                li.append(btn, panel);
                if (item.open === true) setOpen(li, true);
            } else if (item.path) {
                // 문서 한 장: 눌러서 바로 이동
                const a = document.createElement("a");
                a.className = "toc-link";
                a.href = toUrl(item.path).href;
                a.textContent = item.title || item.path;
                li.appendChild(a);
            } else {
                return;     // path 도 children 도 없는 항목은 건너뜀
            }
            ul.appendChild(li);
        });
    }

    const cols = { left: [], right: [] };
    manifest.forEach((item) => {
        if (!item.path && childrenOf(item).length === 0) return;
        cols[columnOf(item)].push(item);
    });

    if (cols.left.length + cols.right.length === 0) {
        showMessage("등록된 문서가 없습니다.",
            ["manifest.js 의 ", code("window.SITE_MANIFEST"), " 에 ", code('{ title: "제목", path: "폴더/파일.html" }'), " 를 추가하세요."]);
        return;
    }

    ["left", "right"].forEach((side) => {
        const section = document.getElementById("toc-" + side);
        if (cols[side].length === 0) { section.remove(); return; }
        renderItems(cols[side], document.getElementById("toc-" + side + "-list"));
    });
    // 한쪽 단이 비면 남은 쪽이 전체 폭을 사용
    if (cols.left.length === 0 || cols.right.length === 0) colsEl.classList.add("is-single");
})();