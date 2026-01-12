
export class DataManager {
    constructor() {
        this.cards = [];
        this.skills = []; // Raw skill data
        this.cardMap = new Map();
    }

    async loadAllData() {
        try {
            console.log("Loading CSV data...");
            const [cardCsv, skillCsv] = await Promise.all([
                this.fetchCSV('card_data.csv'),
                this.fetchCSV('skill_data.csv')
            ]);

            const cardData = this.parseCSV(cardCsv);
            const skillData = this.parseCSV(skillCsv);

            this.processData(cardData, skillData);
            console.log("Data loaded successfully.", this.cards.length, "cards found.");
            return true;
        } catch (e) {
            console.error("Failed to load data:", e);
            alert("データの読み込みに失敗しました。CSVファイルが配置されているか確認してください。\n" + e.message);
            return false;
        }
    }

    async fetchCSV(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('utf-8'); // Assuming UTF-8 used by VSCode view
        return decoder.decode(buffer);
    }

    parseCSV(text) {
        let cleanText = text.trim();
        // Remove BOM if present at the start
        if (cleanText.charCodeAt(0) === 0xFEFF) {
            cleanText = cleanText.slice(1);
        }

        const lines = cleanText.split(/\r\n|\n/);
        // Handle simple split for headers, but prefer splitCSVLine if header contains quotes
        const headers = this.splitCSVLine(lines[0]).map(h => h.trim());

        const result = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const row = this.splitCSVLine(lines[i]);

            if (row.length !== headers.length) {
                // Ignore mismatch lines or try to map roughly
                // continue; 
            }

            const obj = {};
            headers.forEach((h, index) => {
                // If row is shorter, undefined. If header is empty string, ignore?
                if (h) obj[h] = row[index]?.trim();
            });
            result.push(obj);
        }
        return result;
    }

    // Handles commans inside quotes
    splitCSVLine(line) {
        const result = [];
        let current = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    processData(cardsRaw, skillsRaw) {
        // First pass: Process skills
        const skillsByCard = new Map();

        skillsRaw.forEach(s => {
            const cardName = s['カード名'];
            if (!skillsByCard.has(cardName)) {
                skillsByCard.set(cardName, []);
            }
            // Parse numbers
            s.costTU = parseInt(s['消費TU']) || 0;
            s.costMP = parseInt(s['消費MP']) || 0;
            skillsByCard.get(cardName).push(s);
        });

        // Process cards
        this.cards = cardsRaw.filter(c => c['カード名']).map(c => {
            // Stats parsing
            const stats = {
                hp: parseInt(c['HP']) || 100,
                maxHp: parseInt(c['HP']) || 100,
                atk: parseInt(c['攻撃力']) || 10,
                def: parseInt(c['物防']) || 10,
                spAtk: parseInt(c['特攻']) || 10, // 特殊攻撃力
                spDef: parseInt(c['特防']) || 10, // 特殊防御力
                physAtk: parseInt(c['物攻']) || 10, // 物理攻撃力
                spd: parseInt(c['俊敏性']) || 10,

                // Base Stats
                brutality: parseInt(c['狂暴性']) || 0,
                humanity: parseInt(c['人間性']) || 0,
                durability: parseInt(c['耐久性']) || 0,
                magic: parseInt(c['魔性']) || 0
            };

            // Attach skills
            const cardSkills = skillsByCard.get(c['カード名']) || [];
            // Sort active skills by sequential number? CSV has '連番'
            const activeSkills = cardSkills.filter(s => s['スキル種別'] === 'アクティブスキル')
                .sort((a, b) => (parseInt(a['連番']) || 0) - (parseInt(b['連番']) || 0));

            const passiveSkills = cardSkills.filter(s => s['スキル種別'] === 'パッシブスキル');

            return {
                id: c['ソートNo'] || Math.random().toString(), // Unique ID if needed
                name: c['カード名'],
                characterName: c['キャラクター名'],
                rarity: c['レア度'],
                element: c['属性'], // 赤, 青, 緑
                type: c['アタッカータイプ'], // 物理, 特殊
                image: c['画像URL'],

                stats: stats,

                uniqueSkill: {
                    name: c['ユニークスキル名'],
                    effect: c['ユニークスキル効果']
                },

                activeSkills: activeSkills,
                passiveSkills: passiveSkills,

                // Runtime attributes
                currentHP: stats.maxHp,
                currentTU: 0,
                statusEffects: []
            };
        });

        // Filter out incomplete data if any
        this.cards = this.cards.filter(c => c.name && c.stats.maxHp > 0);
    }

    getRandomCards(count = 6) {
        // Fisher-Yates shuffle
        const shuffled = [...this.cards];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, count);
    }

    // Get random pool for draft, ensuring specific attributes if needed?
    // Just returning a large pool for the user to pick from.
    getDraftPool(count = 20) {
        return this.getRandomCards(count);
    }
}
