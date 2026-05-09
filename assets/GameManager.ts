import { _decorator, Component, Node, Prefab, instantiate, UITransform, Vec3, Button, SpriteFrame } from 'cc';
import { Card, CardData, Suit } from './Card';
const { ccclass, property } = _decorator;

class GameSnapshot {
    deskCards: { pos: Vec3, data: CardData }[] = [];
    handCards: { pos: Vec3, data: CardData }[] = [];
    backupCards: { pos: Vec3, data: CardData }[] = [];
}

@ccclass('GameManager')
export class GameManager extends Component {
    @property(Node)
    deskArea: Node = null!;
    @property(Node)
    handArea: Node = null!;
    @property(Node)
    backupArea: Node = null!;
    @property(Button)
    undoButton: Button = null!;

    @property(Prefab)
    cardPrefab: Prefab = null!;

    @property([SpriteFrame])
    suitFrames: SpriteFrame[] = [];
    @property([SpriteFrame])
    blackNumberFrames: SpriteFrame[] = [];
    @property([SpriteFrame])
    redNumberFrames: SpriteFrame[] = [];

    private history: GameSnapshot[] = [];
    private maxHistory: number = 50;
    private isProcessing: boolean = false;
    private gameWinFlag: boolean = false;
    private isInitializing: boolean = false;

    onLoad() {
        this.initGame();
        this.undoButton?.node.on(Button.EventType.CLICK, this.undo, this);
        this.backupArea?.on(Node.EventType.TOUCH_END, this.drawBackupCard, this);
    }

    onDestroy() {
        this.undoButton?.node.off(Button.EventType.CLICK, this.undo, this);
        this.backupArea?.off(Node.EventType.TOUCH_END, this.drawBackupCard, this);
    }

    initGame() {
        if (this.isInitializing) return;
        this.isInitializing = true;
        this.history = [];
        this.gameWinFlag = false;
        this.generateRandomGame();
        this.saveSnapshot();
        console.log(`[Init] 历史快照数量: ${this.history.length}`);
        this.isInitializing = false;
    }

    private generateRandomGame() {
        this.clearAreas();

        // 手牌顶牌（固定位置 0,0）
        const handValue = Math.floor(Math.random() * 13) + 1;
        const handSuit = Math.floor(Math.random() * 4);
        const topCard = this.createCardNode(new CardData(handSuit, handValue));
        if (topCard) {
            topCard.setParent(this.handArea);
            topCard.setPosition(Vec3.ZERO);
            console.log(`[Ready] 手牌顶牌: 点数${handValue} 花色${handSuit}`);
        } else {
            console.error("创建手牌顶牌失败");
        }

        // 桌面牌 12 张（网格，去重）
        const deskData = this.generateSolvableDeskCards(handValue, 12);
        const cols = 4;
        const startX = -380, startY = 620, cardW = 120, cardH = 180, spaceX = 30, spaceY = 40;
        const usedPositions = new Set<string>();
        let generated = 0;
        for (let i = 0; i < deskData.length && generated < 12; i++) {
            const row = Math.floor(generated / cols);
            const col = generated % cols;
            const posX = startX + col * (cardW + spaceX);
            const posY = startY - row * (cardH + spaceY);
            const posKey = `${posX},${posY}`;
            if (usedPositions.has(posKey)) continue;
            const cardNode = this.createCardNode(deskData[i]);
            if (cardNode) {
                cardNode.setParent(this.deskArea);
                cardNode.setPosition(new Vec3(posX, posY, 0));
                usedPositions.add(posKey);
                generated++;
            }
        }

        // 备用牌堆（保证与桌面某牌匹配）
        const deskCardDataList = this.getCurrentDeskCardDataList();
        for (let i = 0; i < 5; i++) {
            const validCard = this.generateValidBackupCard(deskCardDataList);
            if (!validCard) continue;
            const cardNode = this.createCardNode(validCard);
            if (cardNode) {
                cardNode.setParent(this.backupArea);
                cardNode.setPosition(new Vec3(-60 + i * 20, -i * 16, 0));
            }
        }
    }

    private clearAreas() {
        this.deskArea.removeAllChildren();
        this.handArea.removeAllChildren();
        this.backupArea.removeAllChildren();
    }

    private getCurrentDeskCardDataList(): CardData[] {
        const list: CardData[] = [];
        this.deskArea.children.forEach(child => {
            const card = child.getComponent(Card);
            if (card) list.push(card.getCardData());
        });
        return list;
    }

    private canMatchWithDesk(cardData: CardData, deskCards: CardData[]): boolean {
        for (const desk of deskCards) {
            if (Math.abs(cardData.value - desk.value) === 1) return true;
        }
        return false;
    }

    private generateValidBackupCard(deskCards: CardData[]): CardData | null {
        if (deskCards.length === 0) return null;
        const validValues = new Set<number>();
        for (const desk of deskCards) {
            const up = desk.value + 1;
            const down = desk.value - 1;
            if (up >= 1 && up <= 13) validValues.add(up);
            if (down >= 1 && down <= 13) validValues.add(down);
        }
        if (validValues.size === 0) return null;
        const valueArray = Array.from(validValues);
        const randomValue = valueArray[Math.floor(Math.random() * valueArray.length)];
        const randomSuit = Math.floor(Math.random() * 4);
        return new CardData(randomSuit, randomValue);
    }

    private fixNextBackupCard() {
        if (this.backupArea.children.length === 0) return;
        const nextCardNode = this.backupArea.children[0];
        const card = nextCardNode.getComponent(Card);
        if (!card) return;
        const currentDeskData = this.getCurrentDeskCardDataList();
        if (currentDeskData.length === 0) return;
        if (this.canMatchWithDesk(card.getCardData(), currentDeskData)) return;
        let retry = 0;
        let newData: CardData | null = null;
        while (retry < 20) {
            newData = this.generateValidBackupCard(currentDeskData);
            if (newData && this.canMatchWithDesk(newData, currentDeskData)) break;
            retry++;
        }
        if (newData) {
            const suitFrame = this.suitFrames[newData.suit];
            const isRed = newData.suit === Suit.Heart || newData.suit === Suit.Diamond;
            const numFrames = isRed ? this.redNumberFrames : this.blackNumberFrames;
            const numFrame = numFrames[newData.value - 1];
            card.setup(newData, suitFrame, numFrame);
            (card as any)._cardData = newData;
        }
    }

    private generateSolvableDeskCards(start: number, count: number): CardData[] {
        const vals: number[] = [];
        let cur = start;
        for (let i = 0; i < count; i++) {
            let next: number;
            do { next = cur + (Math.random() < 0.5 ? 1 : -1); } while (next < 1 || next > 13);
            cur = next;
            vals.push(cur);
        }
        return vals.map(v => new CardData(Math.floor(Math.random() * 4), v));
    }

    public createCardNode(data: CardData): Node | null {
        if (!data || data.value < 1 || data.value > 13) return null;
        const node = instantiate(this.cardPrefab);
        const card = node.getComponent(Card);
        const suitFrame = this.suitFrames[data.suit];
        const isRed = data.suit === Suit.Heart || data.suit === Suit.Diamond;
        const numFrames = isRed ? this.redNumberFrames : this.blackNumberFrames;
        const numFrame = numFrames[data.value - 1];
        if (!suitFrame || !numFrame) {
            node.destroy();
            return null;
        }
        card.setup(data, suitFrame, numFrame);
        return node;
    }

    // 实时获取手牌顶牌（位置为原点的那张牌）
    private getHandTopCard(): Card | null {
        const children = this.handArea.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.position.equals(Vec3.ZERO)) {
                return child.getComponent(Card);
            }
        }
        return null;
    }

    private saveSnapshot() {
        const snap = new GameSnapshot();
        const saveArea = (area: Node, target: { pos: Vec3, data: CardData }[]) => {
            area.children.forEach(child => {
                const card = child.getComponent(Card);
                if (card) {
                    target.push({
                        pos: child.position.clone(),
                        data: new CardData(card.getCardData().suit, card.getCardData().value)
                    });
                }
            });
        };
        saveArea(this.deskArea, snap.deskCards);
        saveArea(this.handArea, snap.handCards);
        saveArea(this.backupArea, snap.backupCards);
        this.history.push(snap);
        while (this.history.length > this.maxHistory) this.history.shift();
        console.log(`[Save] 快照数量: ${this.history.length} | 手牌区有 ${this.handArea.children.length} 张牌`);
    }

    private restoreFromSnapshot(snap: GameSnapshot) {
        this.clearAreas();

        const restore = (items: { pos: Vec3, data: CardData }[], parent: Node) => {
            for (const item of items) {
                const node = this.createCardNode(item.data);
                if (node) {
                    node.setParent(parent);
                    node.setPosition(item.pos);
                }
            }
        };
        restore(snap.deskCards, this.deskArea);
        restore(snap.handCards, this.handArea);
        restore(snap.backupCards, this.backupArea);
        
        // 验证手牌区只有一张牌且位置为原点
        const handCards = this.handArea.children;
        console.log(`[Restore] 手牌区子节点数: ${handCards.length}`);
        if (handCards.length !== 1) {
            console.error(`回退后手牌区应有1张牌，实际有${handCards.length}张！`);
            // 手动修复：删除多余的牌
            for (let i = handCards.length - 1; i > 0; i--) {
                handCards[i].destroy();
            }
        }
        const topCard = this.getHandTopCard();
        if (topCard) {
            console.log(`[Restore] 手牌顶牌点数: ${topCard.getCardData().value}, 花色: ${topCard.getCardData().suit}`);
        } else {
            console.error("回退后手牌区找不到顶牌！");
        }
    }

    private undo() {
        if (this.isProcessing || this.gameWinFlag) return;
        if (this.history.length <= 1) {
            console.log("没有可撤销的历史");
            return;
        }
        this.isProcessing = true;
        // 弹出当前状态（最后一个快照）
        this.history.pop();
        const previous = this.history[this.history.length - 1];
        this.restoreFromSnapshot(previous);
        console.log(`[Undo] 剩余快照: ${this.history.length}`);
        this.isProcessing = false;
    }

    public onCardClicked(card: Card) {
        if (this.isProcessing || this.gameWinFlag) return;
        const topCard = this.getHandTopCard();
        if (!topCard) {
            console.warn("没有找到手牌顶牌");
            return;
        }
        const parent = card.node.parent;
        if (parent === this.deskArea) {
            const deskVal = card.getCardData().value;
            const topVal = topCard.getCardData().value;
            if (Math.abs(deskVal - topVal) === 1) {
                this.executeMove(card, topCard);
            }
        } else if (parent === this.handArea && card !== topCard) {
            this.executeMove(card, topCard);
        }
    }

    private drawBackupCard() {
        if (this.isProcessing || this.gameWinFlag) return;
        if (this.backupArea.children.length === 0) return;
        const backupCardNode = this.backupArea.children[this.backupArea.children.length - 1];
        const backupCard = backupCardNode.getComponent(Card);
        const topCard = this.getHandTopCard();
        if (backupCard && topCard) {
            this.executeMove(backupCard, topCard);
            this.fixNextBackupCard();
        }
    }

    private executeMove(sourceCard: Card, targetCard: Card) {
        this.isProcessing = true;
        sourceCard.moveToNode(targetCard.node, 0.2, () => {
            targetCard.destroyCard();
            sourceCard.node.setParent(this.handArea);
            sourceCard.node.setPosition(Vec3.ZERO);
            if (this.deskArea.children.length === 0) {
                this.onGameWin();
            }
            this.saveSnapshot();
            this.isProcessing = false;
        });
    }

    private onGameWin() {
        if (this.gameWinFlag) return;
        this.gameWinFlag = true;
        console.log("🎉 胜利！3秒后重新开始");
        setTimeout(() => {
            this.initGame();
        }, 3000);
    }
}