// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

export {CustomSelect} from "./CustomSelect";
export type {SelectOption} from "./CustomSelect";
import {CustomSelect as SelectControl, type SelectOption,} from "./CustomSelect";

export function MultiSelect({
                                values,
                                onChange,
                                options,
                                ariaLabel,
                                placeholder = "全部",
                            }: {
    values: string[];
    onChange: (values: string[]) => void;
    options: SelectOption[];
    ariaLabel: string;
    placeholder?: string;
}) {
    return (
        <SelectControl
            values={values}
            onValuesChange={onChange}
            options={[{value: "__ALL__", label: placeholder}, ...options]}
            ariaLabel={ariaLabel}
            placeholder={placeholder}
            className="multi-select"
        />
    );
}

export function Toggle({
                           checked,
                           onChange,
                           disabled,
                           label,
                       }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            className={`toggle-switch ${checked ? "on" : ""}`}
            disabled={disabled}
            onClick={() => onChange(!checked)}
        >
            <i/>
        </button>
    );
}
