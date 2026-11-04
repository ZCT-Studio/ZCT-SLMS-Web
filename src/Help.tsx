// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {type ReactNode, useState} from "react";
import {CircleHelp} from "lucide-react";
import {Dialog} from "./Extras";

export function HelpTip({
                            title = "说明",
                            children,
                        }: {
    title?: string;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                className="help-tip"
                aria-label={title}
                onClick={() => setOpen(true)}
            >
                <CircleHelp size={15}/>
            </button>
            {open && (
                <Dialog title={title} close={() => setOpen(false)}>
                    <div className="help-content">{children}</div>
                    <div className="form-actions">
                        <button
                            type="button"
                            className="primary"
                            onClick={() => setOpen(false)}
                        >
                            知道了
                        </button>
                    </div>
                </Dialog>
            )}
        </>
    );
}
