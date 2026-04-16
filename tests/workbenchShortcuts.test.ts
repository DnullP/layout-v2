import { describe, expect, test } from "bun:test";
import { isCloseActiveTabShortcut } from "../src/vscode-layout/VSCodeWorkbench";

describe("workbench close-tab shortcut", () => {
    test("应识别 Cmd+W 和 Ctrl+W 为关闭当前 tab 的快捷键", () => {
        expect(isCloseActiveTabShortcut({
            key: "w",
            code: "KeyW",
            metaKey: true,
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            defaultPrevented: false,
        })).toBe(true);

        expect(isCloseActiveTabShortcut({
            key: "W",
            code: "KeyW",
            metaKey: false,
            ctrlKey: true,
            altKey: false,
            shiftKey: false,
            defaultPrevented: false,
        })).toBe(true);
    });

    test("应忽略带 Shift/Alt 或已被拦截的按键组合", () => {
        expect(isCloseActiveTabShortcut({
            key: "w",
            code: "KeyW",
            metaKey: true,
            ctrlKey: false,
            altKey: false,
            shiftKey: true,
            defaultPrevented: false,
        })).toBe(false);

        expect(isCloseActiveTabShortcut({
            key: "w",
            code: "KeyW",
            metaKey: true,
            ctrlKey: false,
            altKey: true,
            shiftKey: false,
            defaultPrevented: false,
        })).toBe(false);

        expect(isCloseActiveTabShortcut({
            key: "w",
            code: "KeyW",
            metaKey: true,
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            defaultPrevented: true,
        })).toBe(false);
    });
});