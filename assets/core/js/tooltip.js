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

        this.renderEmptyTags();
        this.renderPotencyTags(); // 추가!

        this.bindEvents();
    }

    // ★ 빈 span 태그를 YAML 데이터 기반으로 자동 채우는 함수
    renderEmptyTags() {
        if (!this.termsData) return;

        // :empty 대신 대상 태그 전체 탐색
        const targets = document.querySelectorAll(".tag, .tip, .kw, .action-cost");

        targets.forEach(el => {
            const rawText = el.textContent.trim();
            // 1. data-val 또는 val 속성 확인
            const attrVal = el.getAttribute("data-val") || el.getAttribute("val") || el.getAttribute("data-num");

            // 2. 태그 내부 텍스트가 순수 숫자인지 판별 (예: 1, 5, +2, -1, 1d10, 2칸 등)
            const isNumericOnly = /^[+-]?\d+(?:[a-zA-Z가-힣]+)?$/.test(rawText);

            // 비어있지도 않고, data-val도 없고, 텍스트가 숫자가 아니면 일반 본문이므로 건너뜀
            const isEmpty = rawText === "";
            if (!isEmpty && !attrVal && !isNumericOnly) return;

            // 부착할 숫자(값) 결정
            const val = attrVal || (isNumericOnly ? rawText : "");

            const data = this.resolveData(el);

            if (data.ko) {
                let displayText = data.ko;
                if (el.classList.contains("damage") && !el.classList.contains("type")) {
                    displayText = `${data.ko} 피해`;
                }

                // 숫자가 있을 때: 줄바꿈 없는 공백(\u00A0)으로 결합
                if (val) {
                    el.classList.add("has-val");
                    el.textContent = `${displayText}\u00A0${val}`;

                    // lang-toggle.js 연동 데이터 (다국어 변환 시 숫자 유지)
                    el.dataset.langTarget = "true";
                    el.dataset.baseKo = `${displayText} ${val}`;
                    el.dataset.baseEn = data.en ? `${data.en} ${val}` : `${displayText} ${val}`;
                } else {
                    el.textContent = displayText;

                    el.dataset.langTarget = "true";
                    el.dataset.baseKo = displayText;
                    el.dataset.baseEn = data.en || displayText;
                }

                if (data.color) {
                    el.style.setProperty("--tag-bg", data.color);
                    el.style.setProperty("--tt-accent", data.color);
                }
            }
        });
    }

    // ★ <potency stat="..." dc="..."> 커스텀 태그 자동 조립
    // ★ <potency> 엔진: terms.yaml의 stat / rule 데이터 연동
    renderPotencyTags() {
        if (!this.termsData) return;

        const statSource = this.termsData.stat || {};
        const ruleSource = this.termsData.rule || {};

        // 1. stat 조회 헬퍼 (YAML 키 매칭 -> 한글/영문 값 역탐색)
        const resolveStat = (token) => {
            const raw = token.trim();
            const lower = raw.toLowerCase();

            // YAML 키 직접 매칭 (might, intuition 등)
            if (statSource[lower]) return statSource[lower];
            if (statSource[raw]) return statSource[raw];

            // ko 또는 en 값으로 역탐색 (완력, Might, 지능 등)
            for (const key in statSource) {
                const item = statSource[key];
                if (item.ko === raw || (item.en && item.en.toLowerCase() === lower)) {
                    return item;
                }
            }
            return { ko: raw, en: raw };
        };

        // 2. grade 조회 헬퍼 (terms.yaml의 rule 섹션에서 조회)
        const resolveGrade = (token) => {
            const raw = token.trim();
            const lower = raw.toLowerCase();

            let matchedKey = "";
            let item = null;

            // YAML 키 직접 매칭 (weak, medium, strong 등)
            if (ruleSource[lower]) {
                matchedKey = lower;
                item = ruleSource[lower];
            } else if (ruleSource[raw]) {
                matchedKey = raw;
                item = ruleSource[raw];
            } else {
                // ko 또는 en 값으로 역탐색 (약, 중, 강 등)
                for (const key in ruleSource) {
                    const r = ruleSource[key];
                    if (r.ko === raw || (r.en && r.en.toLowerCase() === lower)) {
                        matchedKey = key;
                        item = r;
                        break;
                    }
                }
            }

            if (!item) {
                return { ko: raw, en: raw, cls: lower };
            }

            // medium / med 클래스 명칭 통일
            const cls = (matchedKey === "med" || matchedKey === "medium") ? "medium" : matchedKey;
            return { ko: item.ko || raw, en: item.en || raw, cls: cls };
        };

        document.querySelectorAll("potency, .potency[stat]").forEach(el => {
            const rawStat = (el.getAttribute("stat") || "").trim();
            const rawDc = (el.getAttribute("dc") || el.getAttribute("grade") || "").trim();

            // 쉼표/슬래시 분리 후 terms.yaml의 stat에서 각각 조회
            const tokens = rawStat.split(/[,/]\s*/).filter(Boolean);
            const koNames = [];
            const enNames = [];

            tokens.forEach(tok => {
                const info = resolveStat(tok);
                koNames.push(info.ko || tok);
                enNames.push(info.en || tok);
            });

            let statTextKo = "";
            let statTextEn = "";

            if (koNames.length === 1) {
                statTextKo = koNames[0];
                statTextEn = enNames[0];
                el.classList.remove("multi-stat");
            } else if (koNames.length > 1) {
                // 다중 능력치: "중 하나" 결합 및 줄바꿈 클래스 부여
                statTextKo = `${koNames.join(", ")} 중 하나`;
                if (enNames.length === 2) {
                    statTextEn = `${enNames[0]} or ${enNames[1]}`;
                } else {
                    statTextEn = `${enNames.slice(0, -1).join(", ")}, or ${enNames[enNames.length - 1]}`;
                }
                el.classList.add("multi-stat");
            }

            // terms.yaml의 rule에서 등급(약/중/강) 정보 조회
            const gradeInfo = resolveGrade(rawDc);

            el.innerHTML = `
                <span class="stat">${statTextKo}</span>
                <span class="dc-group">
                    <span class="op">&lt;</span>
                    <span class="grade ${gradeInfo.cls}">${gradeInfo.ko}</span>
                </span>
            `.trim();

            // lang-toggle.js 연동 데이터
            el.dataset.langTarget = "true";
            el.dataset.baseKo = `${statTextKo} < ${gradeInfo.ko}`;
            el.dataset.baseEn = `${statTextEn} < ${gradeInfo.en}`;
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

        // 1. 기본 카테고리(category) 식별
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

        // 2. 예약어 제외 후 커스텀 클래스 추출
        // (예: class="tip effect knockback" -> ["effect", "knockback"])
        const systemReserved = [
            "tag", "tip", "kw", "trait", "badge", "action-cost", "type",
            "visible", "inner", "name", "price", "signature"
        ];
        const customClasses = classList.filter(c => !systemReserved.includes(c) && !c.startsWith("tt-"));

        // 3. 서브타입(subType)과 키(key) 동적 결정
        let key = "";

        if (customClasses.length >= 2) {
            // 클래스가 2개 이상인 경우: 첫 번째가 서브타입, 두 번째가 키
            // (예: .tip.effect.knockback, .tag.damage.psychic)
            subType = customClasses[0];
            key = customClasses[1];
        } else if (customClasses.length === 1) {
            const single = customClasses[0];
            const attrKey = target.getAttribute("term-en") || target.getAttribute("id") || "";

            if (attrKey) {
                // <span class="tip skill" term-en="interpersonal"> 형태
                subType = single;
                key = attrKey;
            } else if (this.termsData && this.termsData[single]) {
                // 단독 서브타입이면서 YAML에 해당 그룹이 있는 경우 (예: .tip.effect)
                subType = single;
                key = single;
            } else {
                // 키만 적힌 경우 (예: .tip.concealment)
                key = single;
            }
        }

        // 4. YAML 데이터 매칭
        let item = null;
        if (this.termsData) {
            // 1순위: subType과 key가 모두 맞는 경우 (termsData.effect.knockback)
            if (subType && key && this.termsData[subType] && this.termsData[subType][key]) {
                item = this.termsData[subType][key];
            }
            // 2순위: termsData[subType][subType] 단독 항목 매칭
            else if (subType && this.termsData[subType] && this.termsData[subType][subType]) {
                item = this.termsData[subType][subType];
            }
            // 3순위: subType 미지정 시 YAML 전체 카테고리에서 key 역추적
            else if (key) {
                for (const cat in this.termsData) {
                    if (this.termsData[cat] && this.termsData[cat][key]) {
                        item = this.termsData[cat][key];
                        if (!subType) subType = cat;
                        break;
                    }
                }
            }
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