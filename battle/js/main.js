
import { DataManager } from './dataManager.js';
import { BattleSystem } from './battleSystem.js';
import { UIManager } from './uiManager.js';

class GameApp {
    constructor() {
        this.dataManager = new DataManager();
        this.ui = new UIManager();
        this.battleSystem = new BattleSystem(this.ui);

        // Expose battle system globally for UI helper (Targeting hack for MVP)
        window.battleSystem = this.battleSystem;

        this.init();
    }

    async init() {
        // Load Data
        const success = await this.dataManager.loadAllData();
        if (success) {
            this.ui.hideLoading();
            this.ui.showScreen('title-screen');
            this.setupListeners();
        }
    }

    setupListeners() {
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startDraft();
        });

        document.getElementById('retry-btn').addEventListener('click', () => {
            this.ui.showScreen('title-screen');
        });
    }

    startDraft() {
        this.ui.showScreen('draft-screen');
        this.playerDeck = [];
        this.currentDraftPool = this.dataManager.getDraftPool(20); // Get 20 random cards

        this.renderDraftStep();
    }

    renderDraftStep() {
        const needed = 6 - this.playerDeck.length;
        if (needed <= 0) {
            this.startBattle();
            return;
        }

        this.ui.updateDraftProgress(this.playerDeck.length, this.playerDeck);

        // Show available cards not in deck
        const available = this.currentDraftPool.filter(c => !this.playerDeck.includes(c));

        this.ui.renderDraft(available, (card) => {
            if (this.playerDeck.length < 6) {
                this.playerDeck.push(card);
                this.renderDraftStep();
            }
        });
    }

    startBattle() {
        try {
            console.log("Starting Battle Phase...");
            // Prepare Enemy Deck (Random 6)
            const allCards = this.dataManager.cards;

            if (!allCards || allCards.length === 0) {
                throw new Error("No cards available to generate enemy deck.");
            }

            // Simple random enemies for now
            const enemyDeck = [];
            for (let i = 0; i < 6; i++) {
                enemyDeck.push(allCards[Math.floor(Math.random() * allCards.length)]);
            }

            this.ui.showScreen('battle-screen');
            this.battleSystem.initBattle(this.playerDeck, enemyDeck);
        } catch (e) {
            console.error(e);
            alert("バトルの開始に失敗しました: " + e.message);
        }
    }
}

// Start Game
window.onload = () => {
    new GameApp();
};
