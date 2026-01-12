
export class BattleSystem {
    constructor(ui) {
        this.ui = ui;

        this.players = []; // Array of Unit objects
        this.enemies = []; // Array of Unit objects
        this.reservePlayers = [];
        this.reserveEnemies = [];

        this.timeline = []; // Units sorted by TU
        this.mp = { player: 4, enemy: 4 }; // Initial MP
        this.maxMP = 10;

        this.onTurnEnd = null; // Callback
        this.isProcessing = false;
    }

    // Initialize battle with selected cards
    initBattle(playerDeck, enemyDeck) {
        // Setup Players: First 4 main, rest reserve
        this.players = playerDeck.slice(0, 4).map(c => new Unit(c, 'player'));
        this.reservePlayers = playerDeck.slice(4).map(c => new Unit(c, 'player'));

        // Setup Enemies: Same logic (randomly picked 6)
        this.enemies = enemyDeck.slice(0, 4).map(c => new Unit(c, 'enemy'));
        this.reserveEnemies = enemyDeck.slice(4).map(c => new Unit(c, 'enemy'));

        // Set Initial TU based on Agility
        const allUnits = [...this.players, ...this.enemies];
        allUnits.forEach(u => {
            u.tu = Math.max(0, 1000 - u.baseStats.spd);
            u.currentMP = 4;
        });

        this.updateTimeline();
        this.ui.renderBattle(this.players, this.enemies);
        this.nextPhase();
    }

    async nextPhase() {
        if (this.checkWinLoss()) return;

        // Advance TU
        const minTU = Math.min(...[...this.players, ...this.enemies].filter(u => u.isAlive()).map(u => u.tu));
        if (minTU > 0) {
            [...this.players, ...this.enemies, ...this.reservePlayers, ...this.reserveEnemies].forEach(u => {
                if (u.isAlive()) u.tu -= minTU;
            });
        }

        this.updateTimeline();

        // Find active unit (TU <= 0)
        const activeUnits = [...this.players, ...this.enemies]
            .filter(u => u.isAlive() && u.tu <= 0)
            .sort((a, b) => b.baseStats.spd - a.baseStats.spd); // Higher speed first

        if (activeUnits.length === 0) {
            console.warn("No active unit found, advancing time...");
            setTimeout(() => this.nextPhase(), 100);
            return;
        }

        const activeUnit = activeUnits[0];
        this.ui.highlightActiveUnit(activeUnit);

        // Process status effects at turn start (Poison damage etc)
        await this.processTurnStartStatus(activeUnit);
        if (!activeUnit.isAlive()) {
            this.handleUnitDeath(activeUnit); // Not implemented yet but safe
            this.nextPhase();
            return;
        }

        if (activeUnit.isPlayer) {
            this.ui.showActionMenu(activeUnit, (action) => this.executeAction(activeUnit, action));
        } else {
            // Enemy AI
            await this.sleep(500);
            const action = this.decideEnemyAction(activeUnit);
            this.executeAction(activeUnit, action);
        }
    }

    checkWinLoss() {
        const playerAlive = this.players.some(u => u.isAlive()) || this.reservePlayers.some(u => u.isAlive());
        const enemyAlive = this.enemies.some(u => u.isAlive()) || this.reserveEnemies.some(u => u.isAlive());

        if (!playerAlive) {
            this.ui.showResult(false);
            return true;
        }
        if (!enemyAlive) {
            this.ui.showResult(true);
            return true;
        }

        this.fillEmptySlots();
        return false;
    }

    fillEmptySlots() {
        // Player
        for (let i = 0; i < this.players.length; i++) {
            if (!this.players[i].isAlive() && this.reservePlayers.length > 0) {
                const newUnit = this.reservePlayers.shift();
                newUnit.tu = Math.max(0, 1000 - newUnit.baseStats.spd);
                this.players[i] = newUnit;
                this.ui.log(`${newUnit.data.name} joined the battle!`);
            }
        }
        // Enemy
        for (let i = 0; i < this.enemies.length; i++) {
            if (!this.enemies[i].isAlive() && this.reserveEnemies.length > 0) {
                const newUnit = this.reserveEnemies.shift();
                newUnit.tu = Math.max(0, 1000 - newUnit.baseStats.spd);
                this.enemies[i] = newUnit;
            }
        }
        this.ui.renderBattle(this.players, this.enemies);
    }

    handleUnitDeath(unit) {
        // Placeholder
    }

    async executeAction(unit, action) {
        try {
            this.ui.hideActionMenu();

            const skill = action.skill;
            let targets = action.targets;

            // Auto-target fallback logic
            if (!targets || targets.length === 0) {
                const isAttack = parseFloat(skill['ダメージ倍率']) > 0 || (skill['ダメージ倍率'] && skill['ダメージ倍率'].includes('倍'));
                const isHeal = skill['効果内容'] && (skill['効果内容'].includes('回復') || skill['効果内容'].includes('ライフフリップ'));
                const isBuff = skill['効果内容'] && (skill['効果内容'].includes('アップ') || skill['効果内容'].includes('ブースト'));

                const opponents = unit.isPlayer ? this.enemies : this.players;
                // const allies = unit.isPlayer ? this.players : this.enemies;

                const aliveOpponents = opponents.filter(u => u.isAlive());

                if (isAttack) {
                    const targetText = skill['攻撃対象'] || "";
                    if (targetText.includes('全体')) {
                        targets = aliveOpponents;
                    } else if (targetText.includes('2体')) {
                        targets = aliveOpponents.sort(() => 0.5 - Math.random()).slice(0, 2);
                    } else {
                        if (aliveOpponents.length > 0) {
                            targets = [aliveOpponents[Math.floor(Math.random() * aliveOpponents.length)]];
                        }
                    }
                } else if (isHeal || isBuff) {
                    targets = [unit];
                } else {
                    // Fallback
                    if (aliveOpponents.length > 0) {
                        targets = [aliveOpponents[Math.floor(Math.random() * aliveOpponents.length)]];
                    }
                }
            }

            if (!targets || targets.length === 0) {
                console.warn("No valid targets found for action", skill);
                this.ui.log("Miss! (No targets)");
                targets = [];
            } else {
                this.ui.log(`Targeting: ${targets.map(t => t.data.name).join(', ')}`);
            }

            // Pay Cost
            unit.currentMP -= skill.costMP;

            this.ui.log(`${unit.data.name} uses ${skill['スキル名']}!`);
            await this.ui.animateSkillName(unit, skill['スキル名']);

            // Calculate Damage / Effect
            for (const target of targets) {
                if (!target.isAlive()) continue;

                let multiplier = parseFloat(skill['ダメージ倍率']);
                if (isNaN(multiplier)) {
                    if (skill['ダメージ倍率'] && skill['ダメージ倍率'].includes('-')) {
                        multiplier = 2.0;
                    } else {
                        multiplier = 0;
                    }
                }

                if (multiplier > 0) {
                    const isPhys = unit.data.type === '物理';
                    const atk = isPhys ? unit.getStat('physAtk') : unit.getStat('spAtk');
                    const def = isPhys ? target.getStat('def') : target.getStat('spDef');

                    let elementMod = 1.0;
                    const ue = unit.data.element;
                    const te = target.data.element;
                    if ((ue === '青' && te === '赤') || (ue === '赤' && te === '緑') || (ue === '緑' && te === '青')) {
                        elementMod = 1.5;
                    } else if ((ue === '赤' && te === '青') || (ue === '緑' && te === '赤') || (ue === '青' && te === '緑')) {
                        elementMod = 0.75;
                    }

                    let damage = Math.floor((atk * multiplier * elementMod) * (1000 / (1000 + def)));
                    damage = Math.max(1, damage);

                    target.currentHP -= damage;
                    await this.ui.animateDamage(target, damage, elementMod > 1.0);

                    if (target.currentHP <= 0) {
                        target.currentHP = 0;
                        this.ui.log(`${target.data.name} is defeated!`);
                        // Force update UI for death ? UIManager should handle animation class?
                    }
                }
            }

            // Add TU
            unit.tu += skill.costTU;

            // Small delay before next phase
            await this.sleep(500);
            this.updateTimeline();
            this.nextPhase();
        } catch (e) {
            console.error("Execute Action Error:", e);
            alert("Action Error: " + e.message);
            // Try to recover by skipping turn
            unit.tu += 100;
            this.nextPhase();
        }
    }

    async processTurnStartStatus(unit) {
        // Status checks
    }

    decideEnemyAction(unit) {
        const affordable = unit.data.activeSkills.filter(s => {
            const cost = s.costMP || 0;
            return cost <= 0 || unit.currentMP >= cost;
        });

        if (affordable.length === 0) {
            // Wait fallback
            return {
                skill: { 'スキル名': '待機', costTU: 50, costMP: 0, 'ダメージ倍率': 0 },
                targets: []
            };
        }

        const skill = affordable[Math.floor(Math.random() * affordable.length)];
        let targets = []; // Use auto-target logic in executeAction
        return { skill, targets };
    }

    updateTimeline() {
        this.timeline = [...this.players, ...this.enemies]
            .filter(u => u.isAlive())
            .sort((a, b) => a.tu - b.tu);
        this.ui.renderTimeline(this.timeline);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class Unit {
    constructor(data, side) {
        this.data = data;
        this.isPlayer = side === 'player';
        this.baseStats = data.stats;
        this.currentHP = data.stats.maxHp;
        this.currentMP = 4;
        this.tu = 0;
        this.status = [];
    }

    isAlive() {
        return this.currentHP > 0;
    }

    getStat(name) {
        return this.baseStats[name];
    }
}
