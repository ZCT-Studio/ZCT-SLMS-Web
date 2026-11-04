// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {Menu, X} from "lucide-react";
import {useEffect} from "react";

export function MobileNavigation({
                                     open,
                                     setOpen,
                                 }: {
    open: boolean;
    setOpen: (open: boolean) => void;
}) {
    useEffect(() => {
        const previous = document.body.style.overflow;
        const sync = () => {
            document.body.style.overflow =
                open && window.matchMedia("(max-width:700px)").matches
                    ? "hidden"
                    : previous;
        };
        const escape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        sync();
        window.addEventListener("resize", sync);
        window.addEventListener("keydown", escape);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener("resize", sync);
            window.removeEventListener("keydown", escape);
        };
    }, [open]);
    return (
        <>
            <header className="mobile-navigation">
        <span>
          <strong>ZCT-SLMS</strong>
        </span>
                <button
                    className="icon-button"
                    aria-label={open ? "收起导航" : "展开导航"}
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                >
                    {open ? <X size={22}/> : <Menu size={22}/>}
                </button>
            </header>
            <button
                className="navigation-scrim"
                tabIndex={open ? 0 : -1}
                aria-hidden={!open}
                aria-label="收起导航"
                onClick={() => setOpen(false)}
            />
        </>
    );
}
