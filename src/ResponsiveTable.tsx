import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type ReactElement,
  type TableHTMLAttributes,
} from "react";
type NodeElement = ReactElement<{
  children?: ReactNode;
  colSpan?: number;
  className?: string;
  [key: string]: any;
}>;
function plainText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement(child)
          ? plainText((child as NodeElement).props.children)
          : "",
    )
    .join("");
}
function headers(node: ReactNode): string[] {
  const result: string[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const element = child as NodeElement;
    if (element.type === "th") result.push(plainText(element.props.children));
    else result.push(...headers(element.props.children));
  });
  return result;
}
function cardRows(node: ReactNode, labels: string[]): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    const element = child as NodeElement;
    if (element.type === "tr") {
      let column = 0;
      const cells = (value: ReactNode): ReactNode =>
        Children.map(value, (item) => {
          if (!isValidElement(item)) return item;
          const cell = item as NodeElement;
          if (cell.type === Fragment)
            return cloneElement(cell, {}, cells(cell.props.children));
          if (cell.type !== "td") return cell;
          const span = Number(cell.props.colSpan || 1),
            label = span === 1 ? labels[column] || "" : "";
          column += span;
          return cloneElement(
            cell,
            {
              "data-label": label,
              "data-full-cell": span > 1 ? "true" : undefined,
            },
            <div className="responsive-cell-value">{cell.props.children}</div>,
          );
        });
      return cloneElement(element, {}, cells(element.props.children));
    }
    if (
      element.type === "tbody" ||
      element.type === "tfoot" ||
      element.type === Fragment
    )
      return cloneElement(
        element,
        {},
        cardRows(element.props.children, labels),
      );
    return element;
  });
}
export function ResponsiveTable({
  children,
  className = "",
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width:700px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width:700px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  const content = useMemo(
    () => (mobile ? cardRows(children, headers(children)) : children),
    [children, mobile],
  );
  return (
    <table {...props} role="table" className={"responsive-table " + className}>
      {content}
    </table>
  );
}
