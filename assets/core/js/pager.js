// assets/js/pager.js
(function () {
    // ========================================================
    // [UI 텍스트 및 기호 설정] - 필요할 때 이곳의 문구를 자유롭게 수정하세요.
    // ========================================================
    const PAGER_UI_TEXT = {
        // 1. 목차 드로어 (Drawer)
        drawer: {
            toggleIcon: "☰",                          // 목차 열기 버튼 아이콘
            toggleLabel: "목차",                       // 목차 열기 버튼 텍스트
            toggleAria: "목차 열기",                   // 접근성 라벨
            headerTitle: "목차",                   // 드로어 상단 헤더 제목
            closeAria: "목차 닫기",                    // 닫기 버튼 접근성 라벨
            closeIcon: "&times;",                      // 닫기 버튼 기호 (×)
            currentBadge: "열람중",                    // 현재 열람 중인 문서 뱃지 문구
            groupExpandIcon: "＋",                     // 하위 목차 접혀있을 때 기호
            groupCollapseIcon: "－",                   // 하위 목차 펼쳐졌을 때 기호
            homeSubLabel: "MAIN INDEX",                // 홈 버튼 상단 영문 라벨
            homeArrow: "→",                            // 홈 버튼 우측 화살표
            defaultHomeTitle: "홈",                    // 기본 홈 제목 (manifest 설정 없을 때)
            defaultHomePath: "draw_steel_index.html"   // 기본 홈 링크 경로
        },

        // 2. 하단 페이저 (Bottom Pager)
        pager: {
            prevLabel: "이전",                         // 이전 페이지 버튼 기본 텍스트
            nextLabel: "다음",                         // 다음 페이지 버튼 기본 텍스트
            prevArrow: "◀",                            // 이전 화살표 기호
            nextArrow: "▶",                            // 다음 화살표 기호
            defaultPageTitle: "페이지",                // 제목 태그(h1/h2)가 없을 때의 대체 이름
            // 페이지 카운터 출력 포맷
            formatPageInfo: (current, total) => `PAGE ${current} / ${total}`
        }
    };

    // ========================================================
    // 엔진 로직 시작
    // ========================================================
    const scriptEl =
        document.currentScript ||
        Array.from(document.scripts).find(s => /\/pager\.js(\?|#|$)/.test(s.src));

    const siteRoot = (() => {
        if (!scriptEl) return new URL("./", window.location.href);
        const src = scriptEl.src;
        const i = src.lastIndexOf("/assets/");
        return i !== -1 ? new URL(src.slice(0, i + 1)) : new URL("../", src);
    })();

    function initPager() {
        const manifest = window.SITE_MANIFEST || [];
        const toUrl = (p) => new URL((p || "").replace(/^\/+/, "").replace(/\\/g, "/"), siteRoot);

        const norm = (u) => {
            let p = u.pathname;
            try { p = decodeURIComponent(p); } catch (e) {}
            return p.toLowerCase();
        };

        const childrenOf = (item) => (item && Array.isArray(item.children) ? item.children : []);
        const flat = [];
        const walk = (items) => items.forEach((item) => {
            if (item.path) flat.push(item);
            walk(childrenOf(item));
        });
        walk(manifest);

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
            drawerToggle.innerHTML = `<span class="toggle-icon">${PAGER_UI_TEXT.drawer.toggleIcon}</span><span class="toggle-text">${PAGER_UI_TEXT.drawer.toggleLabel}</span>`;
            drawerToggle.setAttribute("aria-label", PAGER_UI_TEXT.drawer.toggleAria);
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
            // ★ drawer-header 자체를 button으로 변경하여 전체 영역을 닫기 버튼화
            drawer.innerHTML = `
                <button type="button" class="drawer-header" aria-label="${PAGER_UI_TEXT.drawer.closeAria}">
                    <h3>${PAGER_UI_TEXT.drawer.headerTitle}</h3>
                    <span class="drawer-close-icon">${PAGER_UI_TEXT.drawer.closeIcon}</span>
                </button>
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

        // ★ 헤더 전체 클릭 시 드로어 닫기
        const closeHeader = drawer.querySelector(".drawer-header");
        if (closeHeader) closeHeader.onclick = closeDrawer;

        const menuTree = drawer.querySelector("#drawer-menu-tree");
        menuTree.innerHTML = "";

        // ----------------------------------------------------
        // 홈(Home) 버튼 렌더링
        // ----------------------------------------------------
        const homeCfg = window.SITE_HOME === false ? null
            : Object.assign({ title: PAGER_UI_TEXT.drawer.defaultHomeTitle, path: PAGER_UI_TEXT.drawer.defaultHomePath }, window.SITE_HOME || {});
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
                    <span class="home-label">${PAGER_UI_TEXT.drawer.homeSubLabel}</span>
                    <span class="home-title">${homeCfg.title}</span>
                </div>
                <span class="home-arrow">${PAGER_UI_TEXT.drawer.homeArrow}</span>
            `;
            homeGroup.appendChild(homeLink);
            menuTree.appendChild(homeGroup);
        }

        // ----------------------------------------------------
        // Rule 문서 판별 및 h2 세부 목차 추출
        // ----------------------------------------------------
        const isRuleDocument = (item) => {
            const pathStr = (item.path || "").toLowerCase();
            return pathStr.includes("starter-rule") || pathStr.includes("/rule/") || pathStr.includes("rule-");
        };

        const buildRuleH2List = () => {
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

            if (kids.length) {
                kidsUl = document.createElement("ul");
                kidsUl.className = "drawer-sub-list";
                kids.forEach((kid) => kidsUl.appendChild(renderItem(kid, depth + 1)));
                kidsUl.style.display = open ? "" : "none";
            }

            if (cur) {
                link.href = "#";
                link.innerHTML = `
                    <span class="title-text">${item.title}</span>
                    <span class="current-badge">${PAGER_UI_TEXT.drawer.currentBadge}</span>
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
                const getCaret = () => (kidsUl && kidsUl.style.display === "none" ? PAGER_UI_TEXT.drawer.groupExpandIcon : PAGER_UI_TEXT.drawer.groupCollapseIcon);
                link.href = "#";
                link.innerHTML = `<span class="toggle-icon">${getCaret()}</span><span class="title-text">${item.title}</span>`;
                link.onclick = (e) => {
                    e.preventDefault();
                    if (!kidsUl) return;
                    const willShow = kidsUl.style.display === "none";
                    kidsUl.style.display = willShow ? "" : "none";
                    link.querySelector(".toggle-icon").textContent = willShow ? PAGER_UI_TEXT.drawer.groupCollapseIcon : PAGER_UI_TEXT.drawer.groupExpandIcon;
                };
            }
            box.appendChild(link);

            if (cur && isRuleDocument(item)) {
                const h2List = buildRuleH2List();
                if (h2List) box.appendChild(h2List);
            }

            if (kidsUl) box.appendChild(kidsUl);
            return box;
        };

        manifest.forEach((item) => menuTree.appendChild(renderItem(item, 0)));

        // ----------------------------------------------------
        // 하단 페이저 (Bottom Pager)
        // ----------------------------------------------------
        let pagerNav = document.querySelector(".bottom-pager");
        if (!pagerNav) {
            pagerNav = document.createElement("footer");
            pagerNav.className = "bottom-pager";
            pagerNav.innerHTML = `
                <a class="pager-btn" id="prev-btn">
                    <span class="pager-arrow prev">${PAGER_UI_TEXT.pager.prevArrow}</span>
                    <span class="pager-label" id="prev-label">${PAGER_UI_TEXT.pager.prevLabel}</span>
                </a>
                <span class="pager-info" id="pager-info"></span>
                <a class="pager-btn" id="next-btn">
                    <span class="pager-label" id="next-label">${PAGER_UI_TEXT.pager.nextLabel}</span>
                    <span class="pager-arrow next">${PAGER_UI_TEXT.pager.nextArrow}</span>
                </a>
            `;
            document.body.appendChild(pagerNav);
        }

        const pages = Array.from(document.querySelectorAll(".page"));
        const getPageTitle = (el) => {
            if (!el) return "";
            const h = el.querySelector("h1, h2");
            return h ? h.textContent.trim() : PAGER_UI_TEXT.pager.defaultPageTitle;
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
            pagerInfo.textContent = PAGER_UI_TEXT.pager.formatPageInfo(currIdx + 1, totalPages);

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
                setDisabled(prevBtn, prevLabel, PAGER_UI_TEXT.pager.prevLabel);
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
                setDisabled(nextBtn, nextLabel, PAGER_UI_TEXT.pager.nextLabel);
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