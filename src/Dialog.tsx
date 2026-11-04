// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {useEffect, useRef} from "react";
import {createPortal} from "react-dom";

const dialogStack: symbol[] = [];
let dialogOverflow = "";

export function Dialog({
                           title,
                           close,
                           children,
                       }: {
    title: string;
    close: () => void;
    children: React.ReactNode;
}) {
    const identity = useRef(Symbol()),
        panel = useRef<HTMLDivElement>(null),
        closeRef = useRef(close);
    closeRef.current = close;
    useEffect(() => {
        const id = identity.current;
        const previous = document.activeElement as HTMLElement | null;
        if (!dialogStack.length) {
            dialogOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
        }
        dialogStack.push(id);
        panel.current?.focus({preventScroll: true});
        const f = (e: KeyboardEvent) => {
            if (e.key === "Escape" && dialogStack.at(-1) === id) closeRef.current();
            if (e.key === "Tab" && dialogStack.at(-1) === id) {
                const items = [
                    ...(panel.current?.querySelectorAll<HTMLElement>(
                        'button:not(:disabled),input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),a[href],[tabindex="0"]',
                    ) || []),
                ].filter((el) => el.getClientRects().length);
                const first = items[0],
                    last = items.at(-1);
                if (
                    e.shiftKey &&
                    (document.activeElement === first ||
                        document.activeElement === panel.current)
                ) {
                    e.preventDefault();
                    last?.focus();
                } else if (
                    !e.shiftKey &&
                    (document.activeElement === last ||
                        document.activeElement === panel.current)
                ) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener("keydown", f);
        return () => {
            document.removeEventListener("keydown", f);
            const index = dialogStack.indexOf(id);
            if (index >= 0) dialogStack.splice(index, 1);
            if (!dialogStack.length) document.body.style.overflow = dialogOverflow;
            if (previous?.isConnected) previous.focus({preventScroll: true});
        };
    }, []);
    return createPortal(
        <div
            className="overlay"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) close();
            }}
        >
            <div
                className="modal"
                ref={panel}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="modal-head">
                    <h2>{title}</h2>
                    <button className="icon-button" aria-label="关闭" onClick={close}>
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>,
        document.body,
    );
}
