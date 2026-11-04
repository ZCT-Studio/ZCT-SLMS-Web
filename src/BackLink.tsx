// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {ArrowLeft} from "lucide-react";
import type {ReactNode} from "react";

export function BackLink({
                             href,
                             onClick,
                             children,
                         }: {
    href?: string;
    onClick?: () => void;
    children: ReactNode;
}) {
    const content = (
        <>
            <ArrowLeft size={15}/>
            {children}
        </>
    );
    return href ? (
        <a className="details-back" href={href}>
            {content}
        </a>
    ) : (
        <button type="button" className="details-back" onClick={onClick}>
            {content}
        </button>
    );
}
