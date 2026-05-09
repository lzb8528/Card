// UndoableCommand.ts （扩展接口，供未来新增回退类型）
export interface UndoableCommand {
    execute(): void;
    undo(): void;
}

// 未来新增加一个CardSwapCommand示例符合回退扩展
export class CardSwapCommand implements UndoableCommand {
    constructor(cardA: any, cardB: any) {}
    execute() {}
    undo() {}
}