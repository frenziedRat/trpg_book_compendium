// assets/pager.js
(function () {
    // ★ 반드시 initPager 밖(스크립트 실행 시점)에서 잡아야 currentScript가 유효합니다.
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
        const manifest = window.SITE_MANIFEST || [];

        // manifest 경로 -> 절대 URL
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

        // .page 요소 감시
        const pages = Array.from(document.querySelectorAll(".page"));

        const getPageTitle = (el) => {
            if (!el) return "";
            const h = el.querySelector("h1, h2");
            return h ? h.textContent.trim() : "페이지";
        };

        // ----------------------------------------------------
        // Drawer
        // ----------------------------------------------------
        let drawerToggle = document.querySelector(".drawer-toggle-btn");
        if (!drawerToggle) {
            drawerToggle = document.createElement("button");
            drawerToggle.type = "button";
            drawerToggle.className = "drawer-toggle-btn";
            drawerToggle.innerHTML = "☰ 목차";
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

        // 홈 메뉴: 메인 목차 페이지로 돌아가는 링크 (목차 맨 위)
        //  - 기본 대상은 사이트 루트의 draw_steel_index.html
        //  - manifest.js 에서 바꾸려면: window.SITE_HOME = { title: "홈", path: "다른/페이지.html" };
        //  - 끄려면: window.SITE_HOME = false;
        const homeCfg = window.SITE_HOME === false ? null
            : Object.assign({ title: "홈", path: "draw_steel_index.html" }, window.SITE_HOME || {});
        if (homeCfg && homeCfg.path) {
            const homeGroup = document.createElement("div");
            homeGroup.className = "drawer-doc-group drawer-home";
            const homeLink = document.createElement("a");
            homeLink.className = "drawer-doc-title";
            homeLink.href = resolveTargetUrl(homeCfg.path);
            homeLink.textContent = `⌂ ${homeCfg.title}`;
            homeGroup.appendChild(homeLink);
            menuTree.appendChild(homeGroup);
        }

        // 현재 문서의 .page 단위 목록 (페이지가 2개 이상일 때만 표시)
        const buildPageList = () => {
            if (pages.length <= 1) return null;
            const subUl = document.createElement("ul");
            subUl.className = "drawer-h2-list"; // 기존 CSS 재사용
            pages.forEach((pageEl, pIdx) => {
                if (!pageEl.id) pageEl.id = "page-" + pIdx;
                const li = document.createElement("li");
                const a = document.createElement("a");
                a.href = "#" + pageEl.id;
                a.textContent = getPageTitle(pageEl);
                a.onclick = (e) => {
                    e.preventDefault();
                    closeDrawer();
                    pageEl.scrollIntoView({ behavior: "smooth" });
                };
                li.appendChild(a);
                subUl.appendChild(li);
            });
            return subUl;
        };

        // 항목(문서 또는 그룹) 하나를 그림. depth 0 = 최상위, 1 이상 = 하위 메뉴
        //  - 현재 문서: "▶ 제목" + (페이지가 여럿이면) 페이지 목록
        //  - 다른 문서: 링크
        //  - 하위 메뉴(children): 현재 문서가 그 안에 있으면 펼쳐지고, 아니면 접힘 (item.open === true 면 항상 펼침)
        //  - path 가 없는 그룹 제목: 누르면 접고 펼침
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
                kidsUl.className = "drawer-h2-list drawer-sub-list";
                kids.forEach((kid) => kidsUl.appendChild(renderItem(kid, depth + 1)));
                kidsUl.style.display = open ? "" : "none";
            }

            if (cur) {
                link.href = "#";
                link.textContent = `▶ ${item.title}`;
                link.onclick = (e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    closeDrawer();
                };
            } else if (item.path) {
                // 다른 문서: 순수 <a href> (절대 URL)
                link.href = resolveTargetUrl(item.path);
                link.textContent = item.title;
            } else {
                // 그룹 제목 (문서 없음): 접고 펼치기
                const caret = () => (kidsUl && kidsUl.style.display === "none" ? "▸ " : "▾ ");
                link.href = "#";
                link.textContent = caret() + item.title;
                link.onclick = (e) => {
                    e.preventDefault();
                    if (!kidsUl) return;
                    kidsUl.style.display = kidsUl.style.display === "none" ? "" : "none";
                    link.textContent = caret() + item.title;
                };
            }
            box.appendChild(link);

            if (cur) {
                const pageList = buildPageList();
                if (pageList) box.appendChild(pageList);
            }
            if (kidsUl) box.appendChild(kidsUl);
            return box;
        };

        manifest.forEach((item) => menuTree.appendChild(renderItem(item, 0)));

        // ----------------------------------------------------
        // Bottom Pager
        // ----------------------------------------------------
        let pagerNav = document.querySelector(".bottom-pager");
        if (!pagerNav) {
            pagerNav = document.createElement("footer");
            pagerNav.className = "bottom-pager";
            pagerNav.innerHTML = `
                <a class="pager-btn" id="prev-btn">
                    <span class="pager-arrow">◀</span>
                    <span class="pager-label" id="prev-label">이전</span>
                </a>
                <span class="pager-info" id="pager-info">PAGE</span>
                <a class="pager-btn" id="next-btn">
                    <span class="pager-label" id="next-label">다음</span>
                    <span class="pager-arrow">▶</span>
                </a>
            `;
            document.body.appendChild(pagerNav);
        }

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

            // 이전
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

            // 다음
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

        // 진단용: 콘솔에서 매칭 상태 확인
        console.log("[Pager] siteRoot:", siteRoot.href, "| fileIndex:", fileIndex, "| here:", here);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPager);
    } else {
        initPager();
    }
})();