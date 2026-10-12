/**
 * Draw Steel Web Rulebook - Global Tooltip & Tag Engine
 */


class TooltipEngine {
    constructor() {
        this.termsData = null;
        this.activeTarget = null;
        this.isTouch = false;

        this.init();
    }

    createTooltipElement() {
        if (document.getElementById("global-tooltip")) return;

        this.el = document.createElement("div");
        this.el.id = "global-tooltip";
        this.el.setAttribute("role", "tooltip");
        this.el.innerHTML = `
            <div class="tt-header">
                <span class="tt-badge"></span>
                <span class="tt-title"></span>
            </div>
            <div class="tt-desc"></div>
            <div class="tt-arrow"></div>
        `;
        document.body.appendChild(this.el);
    }

    // tooltip.js에서 룰 감지 및 YAML 경로 조립
    detectRuleSystem() {
        // <html data-rule="..."> 우선 확인
        if (document.documentElement.dataset.rule) {
            return document.documentElement.dataset.rule;
        }

        // <link href=".../assets/rules/draw_steel/theme.css"> 경로에서 룰 이름 추출
        const ruleLink = document.querySelector('link[href*="/assets/system/"]');
        if (ruleLink) {
            const match = ruleLink.getAttribute("href").match(/\/assets\/system\/([^\/]+)\//);
            if (match) return match[1]; // "draw_steel"
        }

        return "draw_steel";
    }

    async init() {
        this.createTooltipElement();

        // 룰 이름을 찾으면 해당 폴더 안의 terms.yaml을 바로 호출
        const ruleName = this.detectRuleSystem();
        const yamlPath = `../../../assets/system/${ruleName}/terms.yaml`;

        try {
            const res = await fetch(yamlPath);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const yamlText = await res.text();

            if (typeof jsyaml !== "undefined") {
                this.termsData = jsyaml.load(yamlText);
                console.log(`[Tooltip] '${ruleName}.yaml' 로드 성공`);

                // ★ YAML 데이터로 HTML 본문의 빈 태그 텍스트 및 색상 주입
                this.renderEmptyTags();
            } else {
                console.warn("[Tooltip] js-yaml 라이브러리가 로드되지 않았습니다.");
                this.termsData = {};
            }
        } catch (err) {
            console.warn(`[Tooltip] ${yamlPath} 로드 실패:`, err);
            this.termsData = {};
        }

        this.bindEvents();
    }

    // ★ 빈 span 태그를 YAML 데이터 기반으로 자동 채우는 함수
    renderEmptyTags() {
        if (!this.termsData) return;

        const emptyTargets = document.querySelectorAll(".tag:empty, .tip:empty, .kw:empty, .action-cost:empty");

        emptyTargets.forEach(el => {
            const data = this.resolveData(el);

            if (data.ko) {
                // 피해 태그(.tag.damage)는 뒤에 " 피해" 자동 부착 (단, type 태그는 제외)
                let displayText = data.ko;
                if (el.classList.contains("damage") && !el.classList.contains("type")) {
                    displayText = `${data.ko} 피해`;
                }

                el.textContent = displayText;

                // lang-toggle.js 연동용 데이터 속성 부여
                el.dataset.langTarget = "true";
                el.dataset.baseKo = displayText;
                el.dataset.baseEn = data.en;

                // YAML에 color가 지정되어 있으면 스타일 변수 주입
                if (data.color) {
                    el.style.setProperty("--tag-bg", data.color);
                    el.style.setProperty("--tt-accent", data.color);
                }
            }
        });
    }

    bindEvents() {
        const selector = ".tag, .tip, .kw, .trait.badge, .action-cost, h1[term-en], h2[term-en], h3[term-en], h4[term-en], .feat-tag, [term-en], [tool-tip], [tag-text]";

        document.addEventListener("mouseover", (e) => {
            if (this.isTouch) return;
            const target = e.target.closest(selector);
            if (target && target !== this.activeTarget) {
                this.show(target);
            }
        });

        document.addEventListener("mouseout", (e) => {
            if (this.isTouch) return;
            const target = e.target.closest(selector);
            if (target && target === this.activeTarget) {
                if (!target.contains(e.relatedTarget)) {
                    this.hide();
                }
            }
        });

        document.addEventListener("touchstart", () => {
            this.isTouch = true;
        }, { passive: true });

        document.addEventListener("click", (e) => {
            const target = e.target.closest(selector);
            if (target) {
                if (this.activeTarget === target) {
                    this.hide();
                } else {
                    this.show(target);
                }
            } else if (!e.target.closest("#global-tooltip")) {
                this.hide();
            }
        });

        window.addEventListener("resize", () => this.hide());
        window.addEventListener("scroll", () => {
            if (this.activeTarget) this.updatePosition();
        }, { passive: true });
    }

    resolveData(target) {
        const classList = Array.from(target.classList);
        let category = "generic";
        let subType = "";
        let color = "";
        let ko = target.textContent.trim();
        let en = target.getAttribute("term-en") || "";
        let desc = target.getAttribute("tool-tip") || target.getAttribute("tag-text") || "";

        // 1. 카테고리 및 서브타입 판별
        if (classList.includes("tag")) {
            category = "tag";
            if (classList.includes("damage") || classList.includes("type")) subType = "damage";
            else if (classList.includes("condition")) subType = "condition";
            else if (classList.includes("action")) subType = "action";
        } else if (classList.includes("tip")) {
            category = "tip";
            const tipTypes = ["skill", "action", "condition", "damage", "resource", "lore", "rule", "stat", "roll", "test"];
            for (const t of tipTypes) {
                if (classList.includes(t) || classList.includes(`tip-${t}`)) {
                    subType = t;
                    break;
                }
            }
            if (!subType) subType = "rule";
        } else if (classList.includes("kw")) {
            category = "kw";
            subType = "kw";
        } else if (classList.includes("action-cost")) {
            category = "action-cost";
            subType = "action";
        } else if (classList.includes("trait")) {
            category = "trait";
            subType = "trait";
        }

        // 2. YAML 키 추출
        const reserved = ["tag", "tip", "kw", "trait", "badge", "action-cost", "type", subType, `tip-${subType}`];
        const candidateKey = classList.find(c => !reserved.includes(c));
        let key = candidateKey || target.getAttribute("id") || "";
        if (key.startsWith("tip-")) key = key.replace("tip-", "");

        // 3. YAML 데이터 매칭
        if (this.termsData && subType && this.termsData[subType] && this.termsData[subType][key]) {
            const item = this.termsData[subType][key];
            ko = item.ko || ko;
            en = item.en || en;
            desc = desc || item.desc || "";
            color = item.color || "";
        }

        const badgeMap = {
            damage: "피해",
            condition: "상태 이상",
            action: "행동",
            rule: "규칙",
            kw: "키워드",
            resource: "자원",
            stat: "능력치",
            skill: "기술",
            trait: "특성",
            roll: "판정",
            test: "시도"
        };
        const badgeText = badgeMap[subType] || category.toUpperCase();

        return { category, subType, key, ko, en, desc, color, badgeText };
    }

    show(target) {
        if (!this.el) return;

        const data = this.resolveData(target);
        if (!data.en && !data.desc && !data.ko) return;

        this.activeTarget = target;

        // 스타일 클래스 및 Accent 컬러 지정
        this.el.className = "";
        this.el.classList.add(`tt-${data.category}`);
        if (data.subType) this.el.classList.add(`tt-${data.subType}`);
        if (data.key) this.el.classList.add(data.key); // 예: 'acid', 'dazed' 클래스 추가 -> CSS 변수 자동 상속

        if (data.color) {
            this.el.style.setProperty("--tt-accent", data.color);
        } else {
            this.el.style.removeProperty("--tt-accent");
        }

        const badgeEl = this.el.querySelector(".tt-badge");
        const titleEl = this.el.querySelector(".tt-title");
        const descEl = this.el.querySelector(".tt-desc");

        badgeEl.textContent = data.badgeText;

        // ★ [수정] 모드와 상관없이 항상 "ko en" 형태로 조합
        let titleText = data.ko || data.en || "";
        if (data.ko && data.en && data.ko !== data.en) {
            // 본문에 이미 영문이 포함된 경우(예: "달변 Silver Tongue") 중복 방지
            if (!data.ko.toLowerCase().includes(data.en.toLowerCase())) {
                titleText = `${data.ko} ${data.en}`;
            }
        }
        titleEl.textContent = titleText;

        // 설명(desc) 표시
        if (data.desc) {
            descEl.textContent = data.desc;
            descEl.style.display = "block";
        } else {
            descEl.style.display = "none";
        }

        this.el.classList.add("visible");
        this.updatePosition();
    }

    updatePosition() {
        if (!this.activeTarget || !this.el) return;

        const rect = this.activeTarget.getBoundingClientRect();
        const ttRect = this.el.getBoundingClientRect();
        const margin = 8;

        let top = rect.top - ttRect.height - margin;
        let left = rect.left + (rect.width / 2) - (ttRect.width / 2);
        let placeBottom = false;

        if (top < margin) {
            top = rect.bottom + margin;
            placeBottom = true;
        }

        if (left < margin) {
            left = margin;
        } else if (left + ttRect.width > window.innerWidth - margin) {
            left = window.innerWidth - ttRect.width - margin;
        }

        this.el.classList.toggle("place-bottom", placeBottom);
        this.el.style.top = `${window.scrollY + top}px`;
        this.el.style.left = `${window.scrollX + left}px`;
    }

    hide() {
        if (this.el) {
            this.el.classList.remove("visible");
        }
        this.activeTarget = null;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.rulebookTooltip = new TooltipEngine();
});