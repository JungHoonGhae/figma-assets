import type { Page } from "playwright";
import type { NormalizedStyles } from "../types.js";

const MEASURED_PROPERTIES: (keyof NormalizedStyles)[] = [
  "width", "height", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontSize", "fontWeight", "fontFamily", "lineHeight", "letterSpacing",
  "color", "backgroundColor", "borderWidth", "borderColor", "borderRadius",
  "borderStyle", "opacity", "gap", "textAlign",
  "display", "flexDirection", "alignItems", "justifyContent",
  "overflow", "position", "boxShadow", "textDecoration",
  "minWidth", "maxWidth", "minHeight", "maxHeight",
  "alignSelf", "flexGrow", "flexShrink",
  "flexWrap", "rowGap", "columnGap",
];

const CSS_PROPERTY_MAP: Record<string, string> = {
  paddingTop: "padding-top", paddingRight: "padding-right",
  paddingBottom: "padding-bottom", paddingLeft: "padding-left",
  fontSize: "font-size", fontWeight: "font-weight",
  fontFamily: "font-family", lineHeight: "line-height",
  letterSpacing: "letter-spacing", backgroundColor: "background-color",
  borderWidth: "border-top-width", borderColor: "border-top-color",
  borderRadius: "border-top-left-radius", borderStyle: "border-top-style",
  textAlign: "text-align",
  flexDirection: "flex-direction", alignItems: "align-items",
  justifyContent: "justify-content", boxShadow: "box-shadow",
  textDecoration: "text-decoration",
  minWidth: "min-width", maxWidth: "max-width",
  minHeight: "min-height", maxHeight: "max-height",
  alignSelf: "align-self", flexGrow: "flex-grow", flexShrink: "flex-shrink",
  flexWrap: "flex-wrap", rowGap: "row-gap", columnGap: "column-gap",
};

export async function getComputedStyles(page: Page, selector: string): Promise<NormalizedStyles> {
  const properties = MEASURED_PROPERTIES.map((prop) => CSS_PROPERTY_MAP[prop] ?? prop);

  const values = await page.evaluate(
    ({ sel, props }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const computed = window.getComputedStyle(el);
      const result: Record<string, string> = {};
      const rect = el.getBoundingClientRect();
      result["width"] = `${rect.width}px`;
      result["height"] = `${rect.height}px`;
      for (const prop of props) {
        if (prop !== "width" && prop !== "height") {
          result[prop] = computed.getPropertyValue(prop);
        }
      }
      return result;
    },
    { sel: selector, props: properties }
  );

  if (!values) throw new Error(`Element not found: ${selector}`);

  const styles: NormalizedStyles = {};
  for (const prop of MEASURED_PROPERTIES) {
    const cssKey = CSS_PROPERTY_MAP[prop] ?? prop;
    const value = values[cssKey];
    if (value !== undefined && value !== "") {
      styles[prop] = value;
    }
  }
  return styles;
}
