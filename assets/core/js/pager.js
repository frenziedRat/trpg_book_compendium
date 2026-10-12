// assets/js/pager.js
(function () {
    const scriptEl =
        document.currentScript ||
        Array.from(document.scripts).find(s => /\/pager\.js(\?|#|$)/.test(s.src));

// 사이트 루트 = 스크립트 주소에서 "/assets/" 앞부분까지 (manifest.path 의 기준)
// assets/pager.js, assets/js/pager.js 처럼 깊이가 달라도 같은 루트가 나옵니다.
    const siteRoot = (() => {
        if (!scriptEl) return new URL("./", window.location.href);
        const src = scriptEl.src;
        const i = src.lastIndexOf("/assets/");
        return i !== -1 ? new URL(src.slice(0, i + 1)) : new URL("../", src);
    })();

    function initPager() {
        // manifest 경로 -> 절대 URL
        const manifest = window.SITE_MANIFEST || [];
        const toUrl = (p) => new URL((p || "").replace(/^\/+/, "").replace(/\\/g, "/"), siteRoot);

        // 경로 비교용 정규화 (인코딩/대소문자 차이 무시)
        const norm = (u) => {
            let p = u.pathname;
            try { p = decodeURIComponent(p); } catch (e) {}
            return p.toLowerCase();
        };

        // ★ manifest 항목은 하위 메뉴(children)를 가질 수 있습니다.
        //   { title: "직군", children: [ { title: "암행자", path: "..." }, ... ] }
        //   - path 가 있는 항목만 "문서"이고, 이전/다음 버튼은 위에서 아래로 펼친 이 순서를 따릅니다.
        //   - children 이 없는 평면 manifest 도 예전과 똑같이 동작합니다.
        const childrenOf = (item) => (item && Array.isArray(item.children) ? item.children : []);
        const flat = [];
        const walk = (items) => items.forEach((item) => {
            if (item.path) flat.push(item);
            walk(childrenOf(item));
        });
        walk(manifest);

        // 현재 문서의 인덱스 (flat 기준)
        const here = norm(window.location);
        const isCurrent = (item) => !!item.path && norm(toUrl(item.path)) === here;
        const containsCurrent = (item) => isCurrent(item) || childrenOf(item).some(containsCurrent);
        const fileIndex = flat.findIndex(isCurrent);

        const resolveTargetUrl = (targetPath) => (targetPath ? toUrl(targetPath).href : "#");

        // ----------------------------------------------------
        // Drawer 생성 및 초기화
        // ----------------------------------------------------
        let drawerToggle = document.querySelector(".drawer-toggle-btn");
        if (!drawerToggle) {
            drawerToggle = document.createElement("button");
            drawerToggle.type = "button";
            drawerToggle.className = "drawer-toggle-btn";
            // 아이콘과 텍스트 간 여백 분리
            drawerToggle.innerHTML = `<span class="toggle-icon">☰</span><span class="toggle-text">목차</span>`;
            drawerToggle.setAttribute("aria-label", "목차 열기");
            document.body.appendChild(drawerToggle);
        }

        let drawerOverlay = document.querySelector(".drawer-overlay");
        if (!drawerOverlay) {
            drawerOverlay = document.createElement("div");
            drawerOverlay.className = "drawer-overlay";
            document.body.appendChild(drawerOverlay);
        }

        let drawer = document.querySelector("aside.drawer");
        if (!drawer) {
            drawer = document.createElement("aside");
            drawer.className = "drawer";
            drawer.innerHTML = `
                <div class="drawer-header">
                    <h3>CONTENTS</h3>
                    <button type="button" class="drawer-close-btn" aria-label="목차 닫기">&times;</button>
                </div>
                <nav class="drawer-content">
                    <div id="drawer-menu-tree"></div>
                </nav>
            `;
            document.body.appendChild(drawer);
        }

        const openDrawer = () => {
            drawer.classList.add("open");
            drawerOverlay.classList.add("active");
        };
        const closeDrawer = () => {
            drawer.classList.remove("open");
            drawerOverlay.classList.remove("active");
        };

        drawerToggle.onclick = openDrawer;
        drawerOverlay.onclick = closeDrawer;
        const closeBtn = drawer.querySelector(".drawer-close-btn");
        if (closeBtn) closeBtn.onclick = closeDrawer;

        const menuTree = drawer.querySelector("#drawer-menu-tree");
        menuTree.innerHTML = "";

        // ----------------------------------------------------
        // [개선 3] 홈(Home) 버튼 - 세련된 대시보드 카드 형태
        // ----------------------------------------------------
        const homeCfg = window.SITE_HOME === false ? null
            : Object.assign({ title: "홈", path: "draw_steel_index.html" }, window.SITE_HOME || {});
        if (homeCfg && homeCfg.path) {
            const homeGroup = document.createElement("div");
            homeGroup.className = "drawer-home-box";
            const homeLink = document.createElement("a");
            homeLink.className = "drawer-home-link";
            homeLink.href = resolveTargetUrl(homeCfg.path);
            homeLink.innerHTML = `
                <div class="home-icon-wrap">
                    <svg class="home-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </div>
                <div class="home-text-wrap">
                    <span class="home-label">MAIN INDEX</span>
                    <span class="home-title">${homeCfg.title}</span>
                </div>
                <span class="home-arrow">→</span>
            `;
            homeGroup.appendChild(homeLink);
            menuTree.appendChild(homeGroup);
        }

        // ----------------------------------------------------
        // Rule 문서 판별 및 h2 세부 목차 추출 로직
        // ----------------------------------------------------
        const isRuleDocument = (item) => {
            const pathStr = (item.path || "").toLowerCase();
            return pathStr.includes("starter-rule") || pathStr.includes("/rule/") || pathStr.includes("rule-");
        };

        const buildRuleH2List = () => {
            // 본문 내부의 h2 요소만 탐색 (h1, h3, h4 등은 제외)
            const h2Elements = Array.from(document.querySelectorAll(".page h2, main h2"));
            if (h2Elements.length === 0) return null;

            const subUl = document.createElement("ul");
            subUl.className = "drawer-h2-list";

            h2Elements.forEach((h2, idx) => {
                if (!h2.id) h2.id = "section-h2-" + idx;
                const titleText = h2.textContent.trim();
                if (!titleText) return;

                const li = document.createElement("li");
                const a = document.createElement("a");
                a.href = "#" + h2.id;
                a.textContent = titleText;
                a.onclick = (e) => {
                    e.preventDefault();
                    closeDrawer();
                    h2.scrollIntoView({ behavior: "smooth", block: "start" });
                };
                li.appendChild(a);
                subUl.appendChild(li);
            });

            return subUl.children.length > 0 ? subUl : null;
        };

        // ----------------------------------------------------
        // 목차 트리 렌더링
        // ----------------------------------------------------
        const renderItem = (item, depth) => {
            const kids = childrenOf(item);
            const cur = isCurrent(item);
            const holdsCur = kids.some(containsCurrent);

            const box = document.createElement(depth === 0 ? "div" : "li");
            box.className = depth === 0 ? "drawer-doc-group" : "drawer-sub-item";
            if (cur) box.classList.add("current");
            if (holdsCur) box.classList.add("has-current");

            const link = document.createElement("a");
            link.className = depth === 0 ? "drawer-doc-title" : "drawer-sub-title";

            const open = cur || holdsCur || item.open === true;
            let kidsUl = null;

            // 하위 데이터 파일 목록 (직군 하위 클래스들 등)
            if (kids.length) {
                kidsUl = document.createElement("ul");
                kidsUl.className = "drawer-sub-list";
                kids.forEach((kid) => kidsUl.appendChild(renderItem(kid, depth + 1)));
                kidsUl.style.display = open ? "" : "none";
            }

            // 열람중인 카테고리
            if (cur) {
                link.href = "#";
                link.innerHTML = `
                    <span class="title-text">${item.title}</span>
                    <span class="current-badge">현재</span>
                `;
                link.onclick = (e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    closeDrawer();
                };
            } else if (item.path) {
                link.href = resolveTargetUrl(item.path);
                link.innerHTML = `<span class="title-text">${item.title}</span>`;
            } else {
                // 그룹 접기/펼치기
                const getCaret = () => (kidsUl && kidsUl.style.display === "none" ? "＋" : "－");
                link.href = "#";
                link.innerHTML = `<span class="toggle-icon">${getCaret()}</span><span class="title-text">${item.title}</span>`;
                link.onclick = (e) => {
                    e.preventDefault();
                    if (!kidsUl) return;
                    const willShow = kidsUl.style.display === "none";
                    kidsUl.style.display = willShow ? "" : "none";
                    link.querySelector(".toggle-icon").textContent = willShow ? "－" : "＋";
                };
            }
            box.appendChild(link);

            // Rule 문서일 때만 내부 h2 목록 표시
            // (Data 문서는 자식 데이터 목록만 표시)
            if (cur && isRuleDocument(item)) {
                const h2List = buildRuleH2List();
                if (h2List) box.appendChild(h2List);
            }

            if (kidsUl) box.appendChild(kidsUl);
            return box;
        };

        manifest.forEach((item) => menuTree.appendChild(renderItem(item, 0)));

        // ----------------------------------------------------
        // 하단 페이저
        // ----------------------------------------------------
        let pagerNav = document.querySelector(".bottom-pager");
        if (!pagerNav) {
            pagerNav = document.createElement("footer");
            pagerNav.className = "bottom-pager";
            // 이전/다음 화살표와 텍스트 여백 분리
            pagerNav.innerHTML = `
                <a class="pager-btn" id="prev-btn">
                    <span class="pager-arrow prev">◀</span>
                    <span class="pager-label" id="prev-label">이전</span>
                </a>
                <span class="pager-info" id="pager-info">PAGE</span>
                <a class="pager-btn" id="next-btn">
                    <span class="pager-label" id="next-label">다음</span>
                    <span class="pager-arrow next">▶</span>
                </a>
            `;
            document.body.appendChild(pagerNav);
        }

        const pages = Array.from(document.querySelectorAll(".page"));
        const getPageTitle = (el) => {
            if (!el) return "";
            const h = el.querySelector("h1, h2");
            return h ? h.textContent.trim() : "페이지";
        };

        const prevBtn = pagerNav.querySelector("#prev-btn");
        const nextBtn = pagerNav.querySelector("#next-btn");
        const prevLabel = pagerNav.querySelector("#prev-label");
        const nextLabel = pagerNav.querySelector("#next-label");
        const pagerInfo = pagerNav.querySelector("#pager-info");

        const getCurrentPageIndex = () => {
            if (pages.length <= 1) return 0;
            const scrollPos = window.scrollY + 100;
            let active = 0;
            pages.forEach((el, i) => {
                if (el.offsetTop <= scrollPos) active = i;
            });
            return active;
        };

        const setLink = (btn, label, text, href, onclick) => {
            label.textContent = text;
            btn.classList.remove("disabled");
            btn.href = href;
            btn.onclick = onclick;
        };
        const setDisabled = (btn, label, text) => {
            label.textContent = text;
            btn.removeAttribute("href");
            btn.classList.add("disabled");
            btn.onclick = (e) => e.preventDefault();
        };

        const updatePager = () => {
            const totalPages = Math.max(pages.length, 1);
            const currIdx = getCurrentPageIndex();
            pagerInfo.textContent = `PAGE ${currIdx + 1} / ${totalPages}`;

            // 이전 페이지 이동
            if (currIdx > 0 && pages[currIdx - 1]) {
                setLink(prevBtn, prevLabel, getPageTitle(pages[currIdx - 1]), "#", (e) => {
                    e.preventDefault();
                    pages[currIdx - 1].scrollIntoView({ behavior: "smooth" });
                });
            } else if (fileIndex > 0 && flat[fileIndex - 1]) {
                setLink(prevBtn, prevLabel, flat[fileIndex - 1].title,
                    resolveTargetUrl(flat[fileIndex - 1].path), null);
            } else {
                setDisabled(prevBtn, prevLabel, "이전");
            }

            // 다음 페이지 이동
            if (currIdx < pages.length - 1 && pages[currIdx + 1]) {
                setLink(nextBtn, nextLabel, getPageTitle(pages[currIdx + 1]), "#", (e) => {
                    e.preventDefault();
                    pages[currIdx + 1].scrollIntoView({ behavior: "smooth" });
                });
            } else if (fileIndex !== -1 && fileIndex < flat.length - 1) {
                setLink(nextBtn, nextLabel, flat[fileIndex + 1].title,
                    resolveTargetUrl(flat[fileIndex + 1].path), null);
            } else {
                setDisabled(nextBtn, nextLabel, "다음");
            }
        };

        window.addEventListener("scroll", updatePager, { passive: true });
        updatePager();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPager);
    } else {
        initPager();
    }
})();