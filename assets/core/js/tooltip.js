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

    detectRuleSystem() {
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

                this.renderDmgTags();
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

    // ★ YAML 데이터 조회 헬퍼
    findTerm(category, key) {
        if (!this.termsData || !key) return null;

        // 1. 지정된 카테고리 내부에서 탐색
        if (category && this.termsData[category] && this.termsData[category][key]) {
            return this.termsData[category][key];
        }

        // 2. 전체 카테고리 순회 탐색
        for (const cat in this.termsData) {
            if (this.termsData[cat] && this.termsData[cat][key]) {
                return this.termsData[cat][key];
            }
        }
        return null;
    }

    // ★ YAML에서 정의된 피해 속성 목록 동적 추출
    getDamageTypes() {
        if (this.termsData && this.termsData.damage) {
            return Object.keys(this.termsData.damage);
        }
        return ["acid", "cold", "corruption", "fire", "holy", "lightning", "poison", "psychic", "sonic", "untype"];
    }

    // ★ .dmg 컨테이너의 속성/수치를 감지하여 내부에 .tag 요소를 자동 생성
    renderDmgTags() {
        const dmgContainers = document.querySelectorAll(".dmg");
        const damageTypes = this.getDamageTypes();

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

                // 속성이 지정되지 않았을 때의 기본값
                if (!matchedType) {
                    matchedType = "untype";
                    tagEl.dataset.defaultUntype = "true";
                }
                tagEl.classList.add(matchedType);

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
        const damageTypes = this.getDamageTypes();

        targets.forEach(el => {
            if (el.dataset.rendered === "true") return;

            const rawText = el.textContent.trim();
            const attrVal = el.getAttribute("data-val") || el.getAttribute("val") || el.getAttribute("data-num");
            const isNumericOnly = /^[+-]?\d+(?:[a-zA-Z가-힣\s+]+)?$/.test(rawText);

            const isEmpty = rawText === "";
            if (!isEmpty && !attrVal && !isNumericOnly) return;

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

                // ★ 면역/취약 텍스트 및 색상 조립 (.tag와 .tip 모두 적용)
                if (isImmunityOrWeakness) {
                    const specificType = damageTypes.find(t => t !== "untype" && el.classList.contains(t));
                    const ruleKey = isImmunity ? "immunity" : "weakness";
                    const ruleTerm = this.findTerm("rule", ruleKey);
                    const ruleKo = ruleTerm ? ruleTerm.ko : (isImmunity ? "면역" : "취약");
                    const ruleEn = isImmunity ? "Immunity" : "Weakness";

                    // 1. 특정 속성이 있는 경우 (예: 냉기 면역, 산성 취약)
                    if (specificType) {
                        const elemTerm = this.findTerm("damage", specificType);
                        const elemKo = elemTerm ? elemTerm.ko : specificType;
                        const elemEn = elemTerm ? elemTerm.en : specificType;

                        displayText = `${elemKo} ${ruleKo}`;
                        enDisplayText = `${elemEn} ${ruleEn}`;
                    }
                    // 2. 순수 본문 설명용 팁 (<span class="tip rule immunity"></span> 처럼 수치 없는 일반 룰 팁)
                    else if (el.classList.contains("rule") && !el.classList.contains("damage") && !val) {
                        displayText = ruleKo;
                        enDisplayText = (ruleTerm && ruleTerm.en) ? ruleTerm.en : ruleKey;
                    }
                    // 3. 그 외 (.tag, .tip, 수치가 있거나 damage/type이 포함된 경우): "피해" 접두사 및 untype 부여
                    else {
                        displayText = `피해 ${ruleKo}`;
                        enDisplayText = (ruleTerm && ruleTerm.en) ? ruleTerm.en : `Damage ${ruleEn}`;

                        const untypeTerm = this.findTerm("damage", "untype");
                        data.color = (untypeTerm && untypeTerm.color) ? untypeTerm.color : "var(--color-untype, #57534e)";
                        el.classList.add("untype");
                    }
                }
                else if (isDamage) {
                    const isExplicitUntype = (el.classList.contains("untype") || el.classList.contains("untyped")) &&
                        el.dataset.defaultUntype !== "true";

                    if (!isExplicitUntype && (data.key === "untype" || data.key === "untyped")) {
                        displayText = data.badgeText || "피해";
                        enDisplayText = "Damage";
                    } else if (!el.classList.contains("type")) {
                        if (!displayText.endsWith("피해")) {
                            displayText = `${displayText} 피해`;
                        }
                        if (!enDisplayText.toLowerCase().includes("damage")) {
                            enDisplayText = `${enDisplayText} Damage`;
                        }
                    }
                }

                // 색상 변수 주입 (tip 밑줄 색상 포함)
                if (data.color) {
                    el.style.setProperty("--tag-bg", data.color);
                    el.style.setProperty("--tip-color", data.color);
                    el.style.setProperty("--tt-accent", data.color);
                }

                const isLongVal = el.classList.contains("wrap") || val.length >= 10 || val.includes(",");

                // 3번: tag damage + val
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
                // 4번: immunity, weakness + val (tag, tip 모두 반대 배치 적용)
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
                // 일반 수치 표기
                else if (val) {
                    el.classList.add("has-val");
                    el.textContent = `${displayText}\u00A0${val}`;

                    el.dataset.langTarget = "true";
                    el.dataset.baseKo = `${displayText} ${val}`;
                    el.dataset.baseEn = `${enDisplayText} ${val}`;
                }
                // 수치 없는 단일 태그/팁
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

    // ★ <potency> 태그 자동 조립 (terms.yaml의 stat / rule 데이터 연동)
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

            const statItemsHtml = koNames.map(name => `<span class="stat-item">${name}</span>`).join("");
            const gradeInfo = resolveGrade(rawDc);

            el.innerHTML = `
                <span class="stat">${statItemsHtml}</span>
                <span class="op">&lt;</span>
                <span class="grade ${gradeInfo.cls}">${gradeInfo.ko}</span>
            `.trim();

            el.dataset.langTarget = "true";
            el.dataset.baseKo = `${koNames.join(", ")} < ${gradeInfo.ko}`;
            el.dataset.baseEn = `${enNames.join(", ")} < ${gradeInfo.en}`;

            // potency 뒤쪽 상태이상 태그와 문구를 흰색 박스로 래핑
            const col = el.closest(".potency-col, .potency-wrap");
            if (col && !col.querySelector(".potency-box")) {
                const box = document.createElement("div");
                box.className = "potency-box";

                while (el.nextSibling) {
                    box.appendChild(el.nextSibling);
                }

                if (box.textContent.trim() !== "") {
                    col.appendChild(box);
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

        // 2. 예약어 제외 커스텀 클래스 추출
        const systemReserved = [
            "tag", "tip", "kw", "trait", "badge", "action-cost", "type",
            "visible", "inner", "name", "price", "signature", "has-val", "has-split-val", "is-long"
        ];
        const customClasses = classList.filter(c => !systemReserved.includes(c) && !c.startsWith("tt-"));

        // 3. YAML 기반 피해 타입 목록 동적 조회
        const damageTypes = this.getDamageTypes();
        const foundType = customClasses.find(c => damageTypes.includes(c));

        const isImmunity = classList.includes("immunity") || target.getAttribute("term-en") === "immunity";
        const isWeakness = classList.includes("weakness") || target.getAttribute("term-en") === "weakness";
        const isImmunityOrWeakness = isImmunity || isWeakness;

        let key = "";

        // ★ tag, tip 구분 없이 면역/취약 및 피해 타입을 최우선 감지
        if (isImmunityOrWeakness) {
            if (foundType && foundType !== "untype") {
                subType = "damage";
                key = foundType;
            } else {
                subType = "rule";
                key = isImmunity ? "immunity" : "weakness";
            }
        } else if (foundType) {
            subType = "damage";
            key = foundType === "untyped" ? "untype" : foundType;
        } else if (classList.includes("damage") || classList.includes("type")) {
            subType = "damage";
            key = "untype";
            target.classList.add("untype");
        } else if (customClasses.length >= 2) {
            subType = customClasses[0];
            key = customClasses[1];
        } else if (customClasses.length === 1) {
            const single = customClasses[0];
            const attrKey = target.getAttribute("term-en") || target.getAttribute("id") || "";
            if (attrKey) {
                subType = single;
                key = attrKey;
            } else {
                key = single;
            }
        }

        // 4. terms.yaml에서 데이터 조회
        let item = this.findTerm(subType, key);
        if (!item && key) {
            item = this.findTerm(null, key);
        }

        let ko = target.textContent.trim();
        let en = target.getAttribute("term-en") || "";
        let desc = target.getAttribute("tool-tip") || target.getAttribute("tag-text") || "";
        let color = "";

        if (item) {
            ko = item.ko || ko;
            en = item.en || en;
            desc = desc || item.desc || "";
            color = item.color || `var(--color-${key})`;
        } else if (key) {
            color = `var(--color-${key})`;
        }

        // 속성 없는 면역/취약 또는 untype일 때 기본 untype 색상 적용
        if (key === "untype" || (isImmunityOrWeakness && !foundType)) {
            const untypeTerm = this.findTerm("damage", "untype");
            color = (untypeTerm && untypeTerm.color) ? untypeTerm.color : "var(--color-untype, #57534e)";
        }

        // 5. 뱃지 문구 매핑
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
            effect: "효과",
            area: "범위",
            item: "아이템",
            lore: "설정"
        };

        const badgeText = badgeMap[subType] || badgeMap[category] || (subType ? subType.toUpperCase() : category.toUpperCase());

        return { category, subType, key, ko, en, desc, color, badgeText };
    }

    show(target) {
        if (!this.el) return;

        const data = this.resolveData(target);
        if (!data.en && !data.desc && !data.ko) return;

        this.activeTarget = target;

        this.el.className = "";
        this.el.classList.add(`tt-${data.category}`);
        if (data.subType) this.el.classList.add(`tt-${data.subType}`);
        if (data.key) this.el.classList.add(data.key);

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

        let titleText = data.ko || data.en || "";
        if (data.ko && data.en && data.ko !== data.en) {
            if (!data.ko.toLowerCase().includes(data.en.toLowerCase())) {
                titleText = `${data.ko} ${data.en}`;
            }
        }
        titleEl.textContent = titleText;

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
            this.el.style.removeProperty("--active-tip-color");
        }
        this.activeTarget = null;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.rulebookTooltip = new TooltipEngine();
});