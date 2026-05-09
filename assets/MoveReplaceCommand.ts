// MoveReplaceCommand.ts
import { Card, CardData } from './Card';
import { Node } from 'cc';

export class MoveReplaceCommand {
    sourceCard: Card;           // 移动的卡片
    targetCard: Card;           // 被替换的卡片（手牌顶部牌）
    sourceParent: Node;         // 源卡片的原父节点
    sourcePosition: any;        // 原位置
    targetParent: Node;         // 目标父节点
    targetPosition: any;        // 目标位置（顶部牌位置）
    replacedCardData: CardData; // 被替换卡片的数据
    isFromHand: boolean;        // 是否来自手牌区内部替换

    constructor(sourceCard: Card, targetCard: Card, replacedData: CardData, fromHand: boolean) {
        this.sourceCard = sourceCard;
        this.targetCard = targetCard;
        this.replacedCardData = replacedData;
        this.isFromHand = fromHand;
        this.sourceParent = sourceCard.node.parent;
        this.sourcePosition = sourceCard.node.position.clone();
        this.targetParent = targetCard.node.parent;
        this.targetPosition = targetCard.node.position.clone();
    }

    execute(callback?: () => void) {
        // 记录被替换卡片即将被销毁，先保存引用
        let targetNode = this.targetCard.node;
        // 移动源卡片到目标卡片位置并替换
        this.sourceCard.moveToNode(targetNode, 0.2, () => {
            // 销毁被替换的卡片
            if (targetNode && targetNode.isValid) {
                targetNode.destroy();
            }
            // 更新新卡片的父节点和位置已经在moveToNode中完成
            if (callback) callback();
        });
    }

    undo(callback?: () => void) {
        // 撤销：将当前顶部牌（即sourceCard）移回原位，并重新创建被替换的卡片
        let currentTopCard = this.sourceCard;
        let targetParent = this.targetParent;
        let targetPos = this.targetPosition;
        let sourceParent = this.sourceParent;
        let sourcePos = this.sourcePosition;
        
        // 由于原被替换卡片已被销毁，需要重新创建一张新的卡片
        // 注意：创建卡片需要由GameManager完成，这里抛出事件或由外部注入工厂
        // 在GameManager中处理undo时调用重新创建方法
        this.sourceCard.undoMoveTo(() => {
            // 重新创建被替换卡片
            if (callback) callback();
        });
    }
}