import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Vec3, tween } from 'cc';
const { ccclass, property } = _decorator;

export enum Suit { Spade, Heart, Club, Diamond }

export class CardData {
    suit: Suit;
    value: number;
    constructor(suit: Suit, value: number) {
        this.suit = suit;
        this.value = value;
    }
}

@ccclass('Card')
export class Card extends Component {
    @property(Sprite)
    bgSprite: Sprite = null!;
    @property(Sprite)
    suitSprite: Sprite = null!;
    @property(Sprite)
    valueSprite: Sprite = null!;

    private _cardData: CardData = null!;
    private _isInteractive: boolean = true;

    public setup(cardData: CardData, suitFrame: SpriteFrame, numberFrame: SpriteFrame) {
        this._cardData = cardData;
        if (suitFrame) this.suitSprite.spriteFrame = suitFrame;
        if (numberFrame) this.valueSprite.spriteFrame = numberFrame;
    }

    public getCardData(): CardData { return this._cardData; }
    public setInteractive(v: boolean) { this._isInteractive = v; }

    onLoad() {
        this.node.on(Node.EventType.TOUCH_END, this.onClick, this);
    }

    private onClick() {
        if (!this._isInteractive) return;
        const canvas = this.node.scene?.getChildByName('Canvas');
        const gm = canvas?.getComponent('GameManager');
        gm?.onCardClicked(this);
    }

    public moveToNode(targetNode: Node, duration: number, onComplete: () => void) {
        if (!this.node?.isValid || !targetNode?.isValid) {
            onComplete();
            return;
        }
        const canvas = this.node.scene?.getChildByName('Canvas');
        if (!canvas) {
            onComplete();
            return;
        }
        const worldPos = this.node.getWorldPosition();
        const targetParent = targetNode.parent;
        const targetPos = targetParent?.getComponent(UITransform)?.convertToNodeSpaceAR(worldPos) ?? worldPos;
        this.node.setParent(canvas);
        this.node.setWorldPosition(worldPos);
        const targetWorldPos = targetNode.getWorldPosition();
        tween(this.node)
            .to(duration, { worldPosition: targetWorldPos })
            .call(() => {
                if (targetParent && targetParent.isValid) {
                    this.node.setParent(targetParent);
                    this.node.setPosition(targetPos);
                }
                onComplete();
            })
            .start();
    }

    public destroyCard() {
        if (this.node?.isValid) this.node.destroy();
    }
}