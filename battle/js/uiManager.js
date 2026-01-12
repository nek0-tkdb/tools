
export class UIManager {
    constructor() {
        this.elements = {
            loading: document.getElementById('loading-screen'),
            title: document.getElementById('title-screen'),
            draft: document.getElementById('draft-screen'),
            battle: document.getElementById('battle-screen'),
            result: document.getElementById('result-screen'),

            draftContainer: document.getElementById('draft-container'),
            draftCount: document.getElementById('draft-count'),
            deckPreview: document.getElementById('deck-preview'),

            enemiesRow: document.getElementById('enemies-row'),
            playersRow: document.getElementById('players-row'),
            timeline: document.getElementById('timeline'),

            actionPanel: document.getElementById('action-panel'),
            activeUnitInfo: document.getElementById('active-unit-info'),
            centerDisplay: document.getElementById('center-display')
        };
    }

    showScreen(screenId) {
        Object.values(this.elements).forEach(el => {
            if (el && el.classList && el.classList.contains('screen')) {
                el.classList.add('hidden');
                el.classList.remove('active');
            }
        });
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.remove('hidden');
            // Small delay for fade-in transition
            setTimeout(() => target.classList.add('active'), 50);
        }
    }

    hideLoading() {
        this.elements.loading.classList.remove('active');
        setTimeout(() => this.elements.loading.classList.add('hidden'), 500);
    }

    // --- Draft UI ---
    renderDraft(pool, onSelect) {
        this.elements.draftContainer.innerHTML = '';
        pool.forEach(card => {
            const el = this.createCardElement(card);
            el.onclick = () => onSelect(card);
            this.elements.draftContainer.appendChild(el);
        });
    }

    updateDraftProgress(count, deck) {
        this.elements.draftCount.textContent = count;
        this.elements.deckPreview.innerHTML = '';
        deck.forEach(card => {
            const thumb = document.createElement('div');
            thumb.className = 'mini-card';
            thumb.style.backgroundImage = `url('${card.image}')`;
            this.elements.deckPreview.appendChild(thumb);
        });
    }

    createCardElement(card) {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div class="card-type type-${this.getElementColor(card.element)}"></div>
            <div class="card-image" style="background-image: url('${card.image}')"></div>
            <div class="card-info">
                <div class="card-name">${card.name}</div>
                <div class="card-stats">
                    <span>HP:${card.stats.maxHp}</span>
                    <span>SPD:${card.stats.spd}</span>
                </div>
            </div>
        `;
        return div;
    }

    getElementColor(elName) {
        if (elName === '赤') return 'red';
        if (elName === '青') return 'blue';
        if (elName === '緑') return 'green';
        return 'gray';
    }

    // --- Battle UI ---
    renderBattle(players, enemies) {
        this.elements.playersRow.innerHTML = '';
        this.elements.enemiesRow.innerHTML = '';

        // Render Active Players (First 4 or less)
        players.forEach(u => {
            this.elements.playersRow.appendChild(this.createUnitElement(u));
        });
        enemies.forEach(u => {
            this.elements.enemiesRow.appendChild(this.createUnitElement(u));
        });
    }

    createUnitElement(unit) {
        const div = document.createElement('div');
        div.id = `unit-${unit.data.id}`;
        div.className = `battle-unit ${unit.isAlive() ? '' : 'dead'}`;

        // Calculate HP percentage
        const hpPercent = (unit.currentHP / unit.baseStats.maxHp) * 100;
        let hpClass = 'high';
        if (hpPercent < 50) hpClass = 'mid';
        if (hpPercent < 20) hpClass = 'low';

        div.innerHTML = `
            <div class="unit-img" style="background-image: url('${unit.data.image}')"></div>
            <div class="hp-bar-container">
                <div class="hp-bar ${hpClass}" style="width: ${hpPercent}%"></div>
            </div>
        `;
        // Click handler for targeting can be added here
        div.onclick = () => {
            // dispatch event?
        };
        return div;
    }

    renderTimeline(units) {
        this.elements.timeline.innerHTML = '';
        units.slice(0, 10).forEach(u => { // Show next 10 turns
            const div = document.createElement('div');
            div.className = `timeline-unit ${u.isPlayer ? 'player' : 'enemy'}`;
            div.style.backgroundImage = `url('${u.data.image}')`;
            if (u.isPlayer) div.style.borderColor = '#3b82f6';
            else div.style.borderColor = '#ef4444';

            this.elements.timeline.appendChild(div);
        });
    }

    highlightActiveUnit(unit) {
        // Remove old highlights
        document.querySelectorAll('.battle-unit').forEach(el => el.classList.remove('is-acting'));

        // Find visible unit element
        // Since we rebuild DOM in renderBattle often, this might be tricky if not synced.
        // Assuming renderBattle is called on updates. Or we search by ID logic.
        // In createUnitElement we didn't assign unique DOM ID properly linked to memory unit.
        // Let's rely on re-rendering for simplicity or query selector matching is cleaner if units don't move.

        // Better: We redraw units on status change.
        // But for animation, adding class to existing element is better.
        // Let's assume we redraw units every turn? No, that kills animations.
        // We should update existing DOM or find it.
        // For now, let's assume one-way render is okay for MVP.

        // Find element by image URL (hacky) or ID.
        // Let's add IDs to unit objects in DataManager
    }

    showActionMenu(unit, callback) {
        this.elements.actionPanel.innerHTML = '';
        this.elements.activeUnitInfo.textContent = `${unit.data.name}'s Turn (MP: ${unit.currentMP})`;

        unit.data.activeSkills.forEach(skill => {
            const btn = document.createElement('button');
            btn.className = 'skill-btn';

            // Check MP cost (negative is cost, positive is gain)
            const cost = skill.costMP || 0;
            const costStr = cost > 0 ? `+${cost} MP` : `${cost} MP`;
            const affordable = cost > 0 || unit.currentMP >= Math.abs(cost);

            btn.innerHTML = `
                <div class="skill-name">${skill['スキル名']}</div>
                <div class="skill-cost">${costStr} / ${skill.costTU} TU</div>
                <div class="skill-desc">${skill['効果内容']}</div>
            `;

            if (!affordable) btn.disabled = true;

            btn.onclick = () => {
                // Pass empty targets list to let BattleSystem decide auto-targets
                callback({ skill: skill, targets: [] });
            };
            this.elements.actionPanel.appendChild(btn);
        });
    }

    hideActionMenu() {
        this.elements.actionPanel.innerHTML = '';
        this.elements.activeUnitInfo.textContent = '';
    }

    // Removed getAutoTargets to decouple UI from Game Logic

    async animateSkillName(unit, name) {
        const display = this.elements.centerDisplay;
        display.innerHTML = `<div class="damage-number" style="color:#fff; font-size:1.5rem; text-shadow:0 0 5px #000;">${name}</div>`;
        await new Promise(r => setTimeout(r, 1000));
        display.innerHTML = '';
    }

    async animateDamage(unit, damage, isCrit) {
        // Show number on unit element
        // For simple UI, show on center display briefly but stacked?
        // Let's overwriting center display for now (Limitation)
        const display = this.elements.centerDisplay;
        display.innerHTML = `<div class="damage-number ${isCrit ? 'crit' : ''}">${damage}</div>`;
        await new Promise(r => setTimeout(r, 600));
        display.innerHTML = '';
    }

    log(msg) {
        console.log(`[BattleLog] ${msg}`);
        // Show log on screen for debugging
        const info = this.elements.activeUnitInfo;
        if (info) {
            // Prepend log temporarily
            const original = info.innerHTML;
            info.innerHTML = `<div style="color:yellow; font-size:0.8em;">${msg}</div>` + original;
        }
    }

    showResult(isWin) {
        const title = document.getElementById('result-title');
        title.textContent = isWin ? "VICTORY" : "DEFEAT";
        title.style.color = isWin ? "#fbbf24" : "#ef4444";
        this.showScreen('result-screen');
    }
}
