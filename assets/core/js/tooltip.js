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

        const ruleName = this.detectRuleSystem();
        const yamlPath = `../../../assets/system/${ruleName}/terms.yaml`;

        try {
            const res = await fetch(yamlPath);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const yamlText = await res.text();

            if (typeof jsyaml !== "undefined") {
                this.termsData = jsyaml.load(yamlText);
                console.log(`[Tooltip] '${ruleName}.yaml' 로드 성공`);

                // ★ 1. .dmg 컨테이너에서 .tag 요소 자동 조립
                this.renderDmgTags();
                // ★ 2. 조립된 태그 및 기존 빈 태그 일괄 렌더링
                this.renderEmptyTags();
            } else {
                console.warn("[Tooltip] js-yaml 라이브러리가 로드되지 않았습니다.");
                this.termsData = {};
                this.renderDmgTags();
                this.renderEmptyTags();
            }
        } catch (err) {
            console.warn(`[Tooltip] ${yamlPath} 로드 실패:`, err);
            this.termsData = {};
            this.renderDmgTags();
            this.renderEmptyTags();
        }

        this.renderPotencyTags();
        this.bindEvents();
    }

    // ★ .dmg 컨테이너의 속성/수치를 감지하여 내부에 .tag 요소를 자동 생성
    renderDmgTags() {
        const dmgContainers = document.querySelectorAll(".dmg");

        const damageTypes = [
            "acid", "cold", "corruption", "fire", "holy",
            "lightning", "poison", "psychic", "sonic", "untype", "untyped"
        ];

        dmgContainers.forEach(el => {
            if (el.dataset.dmgRendered === "true") return;

            // 본문 텍스트 내 "중 하나" 자동 제거
            el.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.nodeValue.includes("중 하나")) {
                    node.nodeValue = node.nodeValue.replace(/\s*중\s*하나/g, "");
                }
            });

            if (el.querySelector(".tag")) {
                el.dataset.dmgRendered = "true";
                return;
            }

            const classList = Array.from(el.classList);
            let matchedType = damageTypes.find(t => classList.includes(t));
            const hasDamageOrType = classList.includes("damage") || classList.includes("type");
            const attrVal = el.getAttribute("data-val") || el.getAttribute("val") || el.getAttribute("data-num");

            if (hasDamageOrType || matchedType || attrVal) {
                const tagEl = document.createElement("span");
                tagEl.classList.add("tag");

                if (classList.includes("damage")) {
                    tagEl.classList.add("damage");
                } else {
                    tagEl.classList.add("type");
                }

                if (!matchedType) {
                    matchedType = "untype";
                    tagEl.dataset.defaultUntype = "true";
                }
                tagEl.classList.add(matchedType);

                // data-val에서 "중 하나" 제거 후 주입
                if (attrVal) {
                    tagEl.setAttribute("data-val", attrVal.replace(/\s*중\s*하나/g, "").trim());
                }

                if (el.hasAttribute("term-en")) tagEl.setAttribute("term-en", el.getAttribute("term-en"));
                if (el.hasAttribute("tool-tip")) tagEl.setAttribute("tool-tip", el.getAttribute("tool-tip"));

                el.prepend(tagEl);
                el.dataset.dmgRendered = "true";
            }
        });
    }

    // ★ 빈 span 태그를 YAML 데이터 기반으로 자동 채우는 함수
    renderEmptyTags() {
        if (!this.termsData) return;

        const targets = document.querySelectorAll(".tag, .tip, .kw, .action-cost");

        targets.forEach(el => {
            if (el.dataset.rendered === "true") return;

            const rawText = el.textContent.trim();
            const attrVal = el.getAttribute("data-val") || el.getAttribute("val") || el.getAttribute("data-num");
            const isNumericOnly = /^[+-]?\d+(?:[a-zA-Z가-힣\s+]+)?$/.test(rawText);

            const isEmpty = rawText === "";
            if (!isEmpty && !attrVal && !isNumericOnly) return;

            // ★ 수치에서 "중 하나" 완전히 제거
            let val = attrVal || (isNumericOnly ? rawText : "");
            if (val) {
                val = val.replace(/\s*중\s*하나/g, "").trim();
            }

            const data = this.resolveData(el);

            if (data.ko) {
                const isImmunity = el.classList.contains("immunity") || data.key === "immunity";
                const isWeakness = el.classList.contains("weakness") || data.key === "weakness";
                const isImmunityOrWeakness = isImmunity || isWeakness;

                const isDamage = (el.classList.contains("damage") || el.classList.contains("type") || data.subType === "damage") && !isImmunityOrWeakness;
                const isDamageTag = isDamage && (el.classList.contains("tag") || el.classList.contains("damage") || el.classList.contains("type"));

                let displayText = data.ko.replace(/\s*중\s*하나/g, "").trim();
                let enDisplayText = (data.en || displayText).replace(/\s*or\s*one/gi, "").trim();

                if (isImmunityOrWeakness) {
                    const elemKo = (data.subType === "damage" || data.category === "damage") ? data.ko : "";
                    const elemEn = (data.subType === "damage" || data.category === "damage") ? (data.en || data.ko) : "";

                    if (isImmunity) {
                        displayText = elemKo ? `${elemKo} 면역` : "면역";
                        enDisplayText = elemEn ? `${elemEn} Immunity` : "Immunity";
                    } else if (isWeakness) {
                        displayText = elemKo ? `${elemKo} 취약` : "취약";
                        enDisplayText = elemEn ? `${elemEn} Weakness` : "Weakness";
                    }
                } else if (isDamage && !el.classList.contains("type")) {
                    if (!displayText.endsWith("피해")) {
                        displayText = `${displayText} 피해`;
                    }
                    if (!enDisplayText.toLowerCase().includes("damage")) {
                        enDisplayText = `${enDisplayText} Damage`;
                    }
                }

                if (data.color) {
                    el.style.setProperty("--tag-bg", data.color);
                    el.style.setProperty("--tip-color", data.color);
                    el.style.setProperty("--tt-accent", data.color);
                }

                const isLongVal = el.classList.contains("wrap") || val.length >= 10 || val.includes(",");

                if (isDamageTag && val) {
                    el.classList.add("has-split-val");
                    if (isLongVal) el.classList.add("is-long");

                    const koHtml = `<span class="tag-part-val left-arrow">${val}</span><span class="tag-part-label right-arrow">${displayText}</span>`;
                    const enHtml = `<span class="tag-part-val left-arrow">${val}</span><span class="tag-part-label right-arrow">${enDisplayText}</span>`;
                    el.innerHTML = koHtml;

                    el.dataset.langTarget = "true";
                    el.dataset.baseKo = koHtml;
                    el.dataset.baseEn = enHtml;
                }
                else if (isImmunityOrWeakness && val) {
                    el.classList.add("has-split-val");
                    if (isLongVal) el.classList.add("is-long");

                    const koHtml = `<span class="tag-part-label left-arrow">${displayText}</span><span class="tag-part-val right-arrow">${val}</span>`;
                    const enHtml = `<span class="tag-part-label left-arrow">${enDisplayText}</span><span class="tag-part-val right-arrow">${val}</span>`;
                    el.innerHTML = koHtml;

                    el.dataset.langTarget = "true";
                    el.dataset.baseKo = koHtml;
                    el.dataset.baseEn = enHtml;
                }
                else if (val) {
                    el.classList.add("has-val");
                    el.textContent = `${displayText}\u00A0${val}`;

                    el.dataset.langTarget = "true";
                    el.dataset.baseKo = `${displayText} ${val}`;
                    el.dataset.baseEn = `${enDisplayText} ${val}`;
                }
                else {
                    el.textContent = displayText;

                    el.dataset.langTarget = "true";
                    el.dataset.baseKo = displayText;
                    el.dataset.baseEn = enDisplayText;
                }

                el.dataset.rendered = "true";
            }
        });
    }

    // ★ <potency stat="..." dc="..."> 커스텀 태그 자동 조립
    // ★ <potency> 엔진: terms.yaml의 stat / rule 데이터 연동
    renderPotencyTags() {
        if (!this.termsData) return;

        const statSource = this.termsData.stat || {};
        const ruleSource = this.termsData.rule || {};

        const resolveStat = (token) => {
            const raw = token.trim();
            const lower = raw.toLowerCase();
            if (statSource[lower]) return statSource[lower];
            if (statSource[raw]) return statSource[raw];
            for (const key in statSource) {
                const item = statSource[key];
                if (item.ko === raw || (item.en && item.en.toLowerCase() === lower)) {
                    return item;
                }
            }
            return { ko: raw, en: raw };
        };

        const resolveGrade = (token) => {
            const raw = token.trim();
            const lower = raw.toLowerCase();
            let matchedKey = "";
            let item = null;

            if (ruleSource[lower]) {
                matchedKey = lower;
                item = ruleSource[lower];
            } else if (ruleSource[raw]) {
                matchedKey = raw;
                item = ruleSource[raw];
            } else {
                for (const key in ruleSource) {
                    const r = ruleSource[key];
                    if (r.ko === raw || (r.en && r.en.toLowerCase() === lower)) {
                        matchedKey = key;
                        item = r;
                        break;
                    }
                }
            }

            if (!item) return { ko: raw, en: raw, cls: lower };
            const cls = (matchedKey === "med" || matchedKey === "medium") ? "medium" : matchedKey;
            return { ko: item.ko || raw, en: item.en || raw, cls: cls };
        };

        document.querySelectorAll("potency, .potency[stat]").forEach(el => {
            const rawStat = (el.getAttribute("stat") || "").trim();
            const rawDc = (el.getAttribute("dc") || el.getAttribute("grade") || "").trim();

            const tokens = rawStat.split(/[,/]\s*/).filter(Boolean);
            const koNames = [];
            const enNames = [];

            tokens.forEach(tok => {
                const info = resolveStat(tok);
                koNames.push(info.ko || tok);
                enNames.push(info.en || tok);
            });

            // ★ "중 하나" 없이 순수 능력치만 줄바꿈 태그로 감쌈
            const statItemsHtml = koNames.map(name => `<span class="stat-item">${name}</span>`).join("");
            const gradeInfo = resolveGrade(rawDc);

            el.innerHTML = `
                <span class="stat">${statItemsHtml}</span>
                <span class="dc-group">
                    <span class="op">&lt;</span>
                    <span class="grade ${gradeInfo.cls}">${gradeInfo.ko}</span>
                </span>
            `.trim();

            // 다국어 전환 지원
            el.dataset.langTarget = "true";
            el.dataset.baseKo = `${koNames.join(", ")} < ${gradeInfo.ko}`;
            el.dataset.baseEn = `${enNames.join(", ")} < ${gradeInfo.en}`;
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

        // 1. 기본 카테고리 식별
        const baseCategories = ["tag", "tip", "kw", "action-cost", "trait"];
        for (const cat of baseCategories) {
            if (classList.includes(cat)) {
                category = cat;
                break;
            }
        }
        if (category === "action-cost") subType = "action";
        if (category === "kw") subType = "kw";
        if (category === "trait") subType = "trait";

        // 2. 예약어 제외 클래스 필터링
        const systemReserved = [
            "tag", "tip", "kw", "trait", "badge", "action-cost", "type",
            "visible", "inner", "name", "price", "signature", "has-val", "has-split-val", "is-long"
        ];
        const customClasses = classList.filter(c => !systemReserved.includes(c) && !c.startsWith("tt-"));

        // 3. 피해 속성 추출
        const damageTypes = [
            "acid", "cold", "corruption", "fire", "holy",
            "lightning", "poison", "psychic", "sonic", "untype", "untyped"
        ];
        const foundElem = customClasses.find(c => damageTypes.includes(c));

        // ★ HTML에 untype/untyped가 명시적으로 적혀 있었는지 확인
        const isExplicitUntype = (target.classList.contains("untype") || target.classList.contains("untyped")) &&
            target.dataset.defaultUntype !== "true";

        let key = "";

        if (foundElem) {
            subType = "damage";
            key = foundElem === "untyped" ? "untype" : foundElem;
        } else if (classList.includes("damage") || classList.includes("type")) {
            subType = "damage";
            key = "untype";
            target.classList.add("untype");
        } else if (customClasses.length >= 2) {
            subType = customClasses[0];
            key = customClasses[1];
        } else if (customClasses.length === 1) {
            const single = customClasses[0];
            key = single;
        }

        // ★ tag.damage, tag.type 등 속성 클래스가 없는 경우 untype으로 폴백
        else if (classList.includes("damage") || classList.includes("type")) {
            subType = "damage";
            key = "untype";
            target.classList.add("untype");
        } else if (customClasses.length >= 2) {
            subType = customClasses[0];
            key = customClasses[1];
        } else if (customClasses.length === 1) {
            const single = customClasses[0];
            key = single;
        }

        // 4. YAML 데이터 매칭
        let item = null;
        if (this.termsData) {
            if (subType && key && this.termsData[subType] && this.termsData[subType][key]) {
                item = this.termsData[subType][key];
            } else if (key) {
                for (const cat in this.termsData) {
                    if (this.termsData[cat] && this.termsData[cat][key]) {
                        item = this.termsData[cat][key];
                        if (!subType) subType = cat;
                        break;
                    }
                }
            }
        }

        // ★ untype으로 직접 적지 않은 경우 -> 무조건 "피해"로 고정
        if (!isExplicitUntype && (key === "untype" || key === "untyped")) {
            item = {
                ko: "피해",
                en: "Damage",
                desc: (item && item.desc) || "속성이 없는 일반 기본 피해입니다.",
                color: (item && item.color) || "var(--color-untype, #57534e)"
            };
        }
        // ★ untype을 직접 명시했으나 terms.yaml에 정의가 없는 경우의 폴백
        else if (!item && (key === "untype" || key === "untyped")) {
            item = {
                ko: "무속성",
                en: "Untyped",
                desc: "속성이 없는 피해입니다.",
                color: "var(--color-untype, #57534e)"
            };
        }

        // 데이터 반영
        if (item) {
            ko = item.ko || ko;
            en = item.en || en;
            desc = desc || item.desc || "";
            color = item.color || "";
        }

        // 5. 뱃지 문구 매핑 (새로운 카테고리가 들어오면 여기에 추가 가능)
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
            test: "시도",
            effect: "효과",       // ★ effect 추가
            area: "범위",
            item: "아이템",
            lore: "설정"
        };

        // 매핑 목록에 없으면 서브타입 영문 대문자(예: "EFFECT", "AURA")로 폴백
        const badgeText = badgeMap[subType] || badgeMap[category] || (subType ? subType.toUpperCase() : category.toUpperCase());

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

        // ★ [여기 추가] 호버된 .tip 요소의 --tip-color를 읽어 툴팁(#global-tooltip)에 주입
        const computedStyle = window.getComputedStyle(target);
        const tipColor = computedStyle.getPropertyValue("--tip-color").trim();
        if (tipColor) {
            this.el.style.setProperty("--active-tip-color", tipColor);
        } else {
            this.el.style.removeProperty("--active-tip-color");
        }

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
            // ★ [여기 추가] 툴팁이 닫힐 때 주입했던 임시 색상 변수 제거
            this.el.style.removeProperty("--active-tip-color");
        }
        this.activeTarget = null;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.rulebookTooltip = new TooltipEngine();
});