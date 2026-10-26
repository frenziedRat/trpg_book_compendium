/**
 * Draw Steel Web Rulebook - Global Tooltip & Tag Engine
 */

// SVG 아이콘 경로 설정
const TOOLTIP_CONFIG = {
    // SVG 경로 및 표시 설정
    svgBasePath: "../../../assets/core/svg/", // ★ SVG 파일 폴더 경로 (끝에 '/' 포함)
    svgExt: ".svg",                           // 파일 확장자
    showSvgInTooltip: true,                   // 툴팁(#global-tooltip) 앞에 SVG 표시 여부
    showSvgInTag: true,                        // 본문 태그/팁(.tag, .tip) 앞에 SVG 표시 여부
    showSvgInTip: false,                       // 본문 팁(.tip) 앞에 SVG 표시 여부

    // 출력 형태 결정
    outputMethods: ["tag", "tip", "kw", "action-cost"],

    // 서브타입 뱃지 및 한글 매핑.
    subTypes: {
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
        lore: "설정",
        creature: "개체",
    },

    // 순수 시스템 예약어
    systemReserved: [
        "badge", "type", "visible", "inner", "name",
        "price", "signature", "has-val", "has-split-val", "is-long"
    ]
};

class TooltipEngine {
    constructor() {
        this.termsData = null;
        this.activeTarget = null;
        this.isTouch = false;

        this.init().catch(err => console.error("[Tooltip] Init failed:", err));
    }

    // SVG 파일 존재 여부를 체크하여 마스크 HTML을 반환하는 함수
    getSvgIconHtml(svgKey) {
        if (!svgKey) return "";
        const svgPath = `${TOOLTIP_CONFIG.svgBasePath}${svgKey}${TOOLTIP_CONFIG.svgExt}`;
        return `<span class="svg-mask-icon" style="--svg-url: url('${svgPath}')"></span>`;
    }

    createTooltipElement() {
        if (document.getElementById("global-tooltip")) return;

        this.el = document.createElement("div");
        this.el.id = "global-tooltip";
        this.el.setAttribute("role", "tooltip");
        this.el.innerHTML = `
            <div class="tt-header">
                <span class="tt-icon svg-mask-icon" style="display: none;"></span>
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

    // ★ YAML 데이터 조회 헬퍼
    findTerm(category, key) {
        if (!this.termsData || !key) return null;

        if (category && this.termsData[category] && this.termsData[category][key]) {
            return this.termsData[category][key];
        }

        for (const cat in this.termsData) {
            if (this.termsData[cat] && this.termsData[cat][key]) {
                return this.termsData[cat][key];
            }
        }
        return null;
    }

    getDamageTypes() {
        if (this.termsData && this.termsData.damage) {
            return Object.keys(this.termsData.damage);
        }
        return ["acid", "cold", "corruption", "fire", "holy", "lightning", "poison", "psychic", "sonic", "untype"];
    }

    async init() {
        this.createTooltipElement();

        const ruleName = this.detectRuleSystem();
        const yamlPath = `../../../assets/system/${ruleName}/terms.yaml`;

        try {
            const res = await fetch(yamlPath);
            if (!res.ok) {
                console.warn(`[Tooltip] ${yamlPath} 로드 실패: HTTP ${res.status}`);
                this.termsData = {};
                this.renderDmgTags();
                this.renderEmptyTags();
                this.renderPotencyTags();
                this.bindEvents();
                return;
            }

            const yamlText = await res.text();

            if (typeof window["jsyaml"] !== "undefined") {
                this.termsData = window["jsyaml"].load(yamlText);
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

    renderDmgTags() {
        const dmgContainers = document.querySelectorAll(".dmg");
        const damageTypes = this.getDamageTypes();

        dmgContainers.forEach(el => {
            if (el.dataset.dmgRendered === "true") return;

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

    renderEmptyTags() {
        if (!this.termsData) return;

        const targets = document.querySelectorAll(TOOLTIP_CONFIG.outputMethods.map(m => "." + m).join(", "));
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
                const isTag = el.classList.contains("tag");
                const isImmunity = el.classList.contains("immunity") || data.key === "immunity";
                const isWeakness = el.classList.contains("weakness") || data.key === "weakness";
                const isImmunityOrWeakness = isImmunity || isWeakness;

                const isDamage = (el.classList.contains("damage") || el.classList.contains("type") || data.subType === "damage") && !isImmunityOrWeakness;
                const isDamageTag = isTag && isDamage;

                let displayText = data.ko.replace(/\s*중\s*하나/g, "").trim();
                let enDisplayText = (data.en || displayText).replace(/\s*or\s*one/gi, "").trim();

                if (isImmunityOrWeakness) {
                    const specificType = damageTypes.find(t => t !== "untype" && el.classList.contains(t));
                    const ruleKey = isImmunity ? "immunity" : "weakness";
                    const ruleTerm = this.findTerm("rule", ruleKey);
                    const ruleKo = ruleTerm ? ruleTerm.ko : (isImmunity ? "면역" : "취약");
                    const ruleEn = isImmunity ? "Immunity" : "Weakness";

                    if (specificType) {
                        const elemTerm = this.findTerm("damage", specificType);
                        const elemKo = elemTerm ? elemTerm.ko : specificType;
                        const elemEn = elemTerm ? elemTerm.en : specificType;

                        displayText = `${elemKo} ${ruleKo}`;
                        enDisplayText = `${elemEn} ${ruleEn}`;
                    } else if (isTag || val) {
                        displayText = `피해 ${ruleKo}`;
                        enDisplayText = (ruleTerm && ruleTerm.en) ? ruleTerm.en : `Damage ${ruleEn}`;

                        const untypeTerm = this.findTerm("damage", "untype");
                        data.color = (untypeTerm && untypeTerm.color) ? untypeTerm.color : "var(--color-untype, #57534e)";
                        el.classList.add("untype");
                    } else {
                        displayText = ruleKo;
                        enDisplayText = (ruleTerm && ruleTerm.en) ? ruleTerm.en : ruleKey;
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

                if (data.color) {
                    el.style.setProperty("--tag-bg", data.color);
                    el.style.setProperty("--tip-color", data.color);
                    el.style.setProperty("--tt-accent", data.color);
                }

                const isLongVal = el.classList.contains("wrap") || val.length >= 10 || val.includes(",");
                const isExcludedTag = isDamageTag || (isTag && isImmunityOrWeakness);

                if (isDamageTag && val) {
                    el.classList.add("has-split-val");
                    if (isLongVal) el.classList.add("is-long");

                    el.innerHTML = `<span class="tag-part-val left-arrow">${val}</span><span class="tag-part-label right-arrow">${displayText}</span>`;

                    delete el.dataset.langTarget;
                    delete el.dataset.baseKo;
                    delete el.dataset.baseEn;
                }
                else if (isTag && isImmunityOrWeakness && val) {
                    el.classList.add("has-split-val");
                    if (isLongVal) el.classList.add("is-long");

                    el.innerHTML = `<span class="tag-part-label left-arrow">${displayText}</span><span class="tag-part-val right-arrow">${val}</span>`;

                    delete el.dataset.langTarget;
                    delete el.dataset.baseKo;
                    delete el.dataset.baseEn;
                }
                else if (isExcludedTag) {
                    el.textContent = displayText;

                    delete el.dataset.langTarget;
                    delete el.dataset.baseKo;
                    delete el.dataset.baseEn;
                }
                else {
                    const finalKo = val
                        ? (isDamage ? `${val}\u00A0${displayText}` : `${displayText}\u00A0${val}`)
                        : displayText;
                    const baseKo = val
                        ? (isDamage ? `${val} ${displayText}` : `${displayText} ${val}`)
                        : displayText;
                    const baseEn = val
                        ? (isDamage ? `${val} ${enDisplayText}` : `${enDisplayText} ${val}`)
                        : enDisplayText;

                    if (val) el.classList.add("has-val");

                    const showSvg = Boolean(
                        data.svgKey && (
                            (isTag && TOOLTIP_CONFIG.showSvgInTag) ||
                            (el.classList.contains("tip") && TOOLTIP_CONFIG.showSvgInTip)
                        )
                    );

                    if (showSvg) {
                        const iconHtml = this.getSvgIconHtml(data.svgKey);
                        el.innerHTML = `${iconHtml}<span class="tag-label-text">${finalKo}</span>`;

                        const textSpan = el.querySelector(".tag-label-text");
                        textSpan.dataset.langTarget = "true";
                        textSpan.dataset.baseKo = baseKo;
                        textSpan.dataset.baseEn = baseEn;
                        delete el.dataset.langTarget;

                        const iconSpan = el.querySelector(".svg-mask-icon");
                        if (iconSpan) {
                            const imgTest = new Image();
                            imgTest.src = `${TOOLTIP_CONFIG.svgBasePath}${data.svgKey}${TOOLTIP_CONFIG.svgExt}`;
                            imgTest.onerror = () => {
                                iconSpan.style.display = "none";
                                iconSpan.style.margin = "0";
                            };
                        }
                    } else {
                        el.textContent = finalKo;
                        el.dataset.langTarget = "true";
                        el.dataset.baseKo = baseKo;
                        el.dataset.baseEn = baseEn;
                    }
                }

                el.dataset.rendered = "true";
            }
        });
    }

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

        document.querySelectorAll(".potency[stat]").forEach(el => {
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
        const methodSelectors = TOOLTIP_CONFIG.outputMethods.map(m => `.${m}`).join(", ");
        const selector = `${methodSelectors}, .trait, h1[term-en], h2[term-en], h3[term-en], h4[term-en], .feat-tag, [term-en], [tool-tip], [tag-text]`;

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
        let outputMethod = "tag"; // 불필요한 이니셜라이저 경고 방지 기본값

        for (const method of TOOLTIP_CONFIG.outputMethods) {
            if (classList.includes(method)) {
                outputMethod = method;
                break;
            }
        }
        let subType = "";
        if (outputMethod === "action-cost") subType = "action";
        if (outputMethod === "kw") subType = "kw";

        const reservedSet = new Set([
            ...TOOLTIP_CONFIG.outputMethods,
            ...TOOLTIP_CONFIG.systemReserved
        ]);
        const customClasses = classList.filter(c => !reservedSet.has(c) && !c.startsWith("tt-"));

        const subTypeKeys = Object.keys(TOOLTIP_CONFIG.subTypes);
        const damageTypes = this.getDamageTypes();
        const foundType = customClasses.find(c => damageTypes.includes(c));

        const isImmunity = classList.includes("immunity") || target.getAttribute("term-en") === "immunity";
        const isWeakness = classList.includes("weakness") || target.getAttribute("term-en") === "weakness";
        const isImmunityOrWeakness = isImmunity || isWeakness;

        let key;
        let parentKey = "";

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
            target.dataset.defaultUntype = "true";
            target.classList.add("untype");
        } else {
            // [수정 전]
            // const explicitSubType = customClasses.find(c => subTypeKeys.includes(c));
            // if (explicitSubType) {
            //     subType = explicitSubType;
            // }

            // [수정 후]
            // subType이 아직 없을 때만 찾되, 클래스가 1개뿐이면(예: .tip.area) subType이 아니라 key로 쓰도록 보존
            if (!subType && customClasses.length > 1) {
                const explicitSubType = customClasses.find(c => subTypeKeys.includes(c));
                if (explicitSubType) {
                    subType = explicitSubType;
                }
            }

            const remaining = customClasses.filter(c => c !== subType);

            if (remaining.length >= 2) {
                if (!subType) {
                    subType = remaining[0];
                    if (remaining.length >= 3) {
                        parentKey = remaining[1];
                        key = remaining[2];
                    } else {
                        key = remaining[1];
                    }
                } else {
                    parentKey = remaining[0];
                    key = remaining[1];
                }
            } else if (remaining.length === 1) {
                const single = remaining[0];
                if (!subType && !this.findTerm(null, single)) {
                    subType = single;
                    const rawAttr = target.getAttribute("term-en") || target.getAttribute("id") || "";
                    key = rawAttr.trim().toLowerCase().replace(/\s+/g, "-");
                } else {
                    key = single;
                }
            } else {
                const rawAttr = target.getAttribute("term-en") || target.getAttribute("id") || "";
                key = rawAttr.trim().toLowerCase().replace(/\s+/g, "-");
            }
        }

        let parentItem = null;
        if (parentKey) {
            parentItem = this.findTerm(subType, parentKey) || this.findTerm(null, parentKey);
        }

        let item = (parentKey && this.findTerm(parentKey, key)) || this.findTerm(subType, key);
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
            color = item.color
                || (parentItem && parentItem.color)
                || `var(--color-${parentKey || key}, var(--color-${subType}, var(--neutral-600)))`;
        } else if (parentItem) {
            color = parentItem.color || `var(--color-${parentKey}, var(--color-${subType}, var(--neutral-600)))`;
        } else if (key) {
            color = `var(--color-${key}, var(--color-${subType}, var(--neutral-600)))`;
        } else if (subType) {
            color = `var(--color-${subType}, var(--neutral-600))`;
        }

        if (key === "untype" || (isImmunityOrWeakness && !foundType)) {
            const untypeTerm = this.findTerm("damage", "untype");
            color = (untypeTerm && untypeTerm.color) ? untypeTerm.color : "var(--color-untype, #57534e)";
        }

        const badgeMap = TOOLTIP_CONFIG.subTypes;
        const fallbackBadge = subType || key || outputMethod;
        const badgeText = (parentItem && parentItem.ko)
            ? parentItem.ko
            : (badgeMap[subType] || badgeMap[key] || badgeMap[outputMethod] || fallbackBadge.toUpperCase());

        let svgKey = "";
        if (parentKey) {
            svgKey = parentKey;
        } else if (subType === "condition" || subType === "action") {
            svgKey = key;
        }

        return { outputMethod, subType, parentKey, key, svgKey, ko, en, desc, color, badgeText };
    }

    show(target) {
        if (!this.el) return;

        const data = this.resolveData(target);
        if (!data.en && !data.desc && !data.ko) return;

        this.activeTarget = target;

        this.el.className = "";
        this.el.classList.add(`tt-${data.outputMethod}`);
        if (data.subType) this.el.classList.add(`tt-${data.subType}`);
        if (data.parentKey) {
            this.el.classList.add(data.parentKey.trim().toLowerCase().replace(/\s+/g, "-"));
        }
        if (data.key) {
            this.el.classList.add(data.key.trim().toLowerCase().replace(/\s+/g, "-"));
        }

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

        const iconEl = this.el.querySelector(".tt-icon");
        const badgeEl = this.el.querySelector(".tt-badge");
        const titleEl = this.el.querySelector(".tt-title");
        const descEl = this.el.querySelector(".tt-desc");

        if (iconEl) {
            if (TOOLTIP_CONFIG.showSvgInTooltip && data.svgKey) {
                const svgPath = `${TOOLTIP_CONFIG.svgBasePath}${data.svgKey}${TOOLTIP_CONFIG.svgExt}`;

                iconEl.style.display = "none";
                iconEl.style.removeProperty("--svg-url");

                const imgTest = new Image();
                imgTest.src = svgPath;
                imgTest.onload = () => {
                    if (this.activeTarget === target) {
                        iconEl.style.setProperty("--svg-url", `url('${svgPath}')`);
                        iconEl.style.display = "inline-block";
                    }
                };
                imgTest.onerror = () => {
                    if (this.activeTarget === target) {
                        iconEl.style.display = "none";
                        iconEl.style.removeProperty("--svg-url");
                    }
                };
            } else {
                iconEl.style.display = "none";
                iconEl.style.removeProperty("--svg-url");
            }
        }

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